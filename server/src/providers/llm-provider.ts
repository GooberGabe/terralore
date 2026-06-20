import Anthropic from '@anthropic-ai/sdk'

export interface TimelinePromptInput {
  lat: number
  lng: number
  placeLabel: string
  city?: string
  region?: string
  country?: string
  pointOfInterest?: string
  maxEvents: number
  zoom?: number
}

export interface RankedHistoricalEvent {
  title: string
  summary: string
  dateLabel: string
  year: number
  significanceScore: number
  confidence: number
  sources: string[]
}

export interface LlmProvider {
  generateTimeline(input: TimelinePromptInput): Promise<RankedHistoricalEvent[]>
}

// --- Anthropic Claude implementation ---

const LLM_TIMEOUT_MS = 60_000
const SUBMIT_TOOL_NAME = 'submit_timeline_events'

const TIMELINE_TOOL: Anthropic.Tool = {
  name: SUBMIT_TOOL_NAME,
  description:
    'Submit the curated list of historically significant events for the requested location.',
  input_schema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'Ranked list of historically significant events, most significant first.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title of the historical event.' },
            summary: {
              type: 'string',
              description: 'Concise description of the event (2-3 sentences).',
            },
            dateLabel: {
              type: 'string',
              description: 'Human-readable date string (e.g., "circa 1200 BCE", "1944", "May 1453").',
            },
            year: {
              type: 'number',
              description:
                'The approximate year of the event as an integer. Use negative numbers for BCE (e.g., -44 for 44 BCE). Used for chronological ordering.',
            },
            significanceScore: {
              type: 'number',
              description: 'Historical significance score from 0.0 to 1.0.',
            },
            confidence: {
              type: 'number',
              description: 'Confidence in historical accuracy from 0.0 to 1.0.',
            },
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Reference sources (book titles, Wikipedia article names, etc.).',
            },
          },
          required: ['title', 'summary', 'dateLabel', 'year', 'significanceScore', 'confidence', 'sources'],
        },
      },
    },
    required: ['events'],
  },
}

interface TimelineToolInput {
  events: RankedHistoricalEvent[]
}

export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async generateTimeline(input: TimelinePromptInput): Promise<RankedHistoricalEvent[]> {
    const locationContext = buildLocationContext(input)
    const poiLine = input.pointOfInterest
      ? `  Point of Interest: ${input.pointOfInterest}\n`
      : ''

    const specificityInstruction = zoomToSpecificityInstruction(input.zoom)

    const userPrompt =
      `Generate a timeline of up to ${input.maxEvents} historically significant events for this exact location:\n` +
      `  Name: ${locationContext}\n` +
      `  Coordinates: ${input.lat.toFixed(4)}°, ${input.lng.toFixed(4)}°\n` +
      poiLine +
      `\n` +
      `CRITICAL: Only include events that genuinely occurred at or directly relate to this specific geographic location. ` +
      `Do not substitute, conflate, or draw from a different region because this location seems unfamiliar or sparsely documented. ` +
      `If fewer significant events are known for this exact area, return only those — do not pad with events from elsewhere.\n\n` +
      `${specificityInstruction} ` +
      `Rank events by historical significance. ` +
      `Include a mix of eras when applicable.`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

    let message: Anthropic.Message
    try {
      message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 4096,
          system:
            'You are a historical research assistant. Your job is to provide accurate historical events strictly for the geographic location given by the user. ' +
            'You must NEVER substitute a different location — even if the requested location has sparse historical documentation, remote terrain, or is largely uninhabited. ' +
            'If a location has limited recorded history, return only the events you can genuinely attribute to it; do not borrow events from nearby or more famous places. ' +
            'Only include events with a reasonable confidence in their historical accuracy. ' +
            'You must use the provided tool to submit your response.',
          tools: [TIMELINE_TOOL],
          tool_choice: { type: 'tool', name: SUBMIT_TOOL_NAME },
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: controller.signal },
      )
    } finally {
      clearTimeout(timer)
    }

    const toolUseBlock = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )

    if (!toolUseBlock) {
      throw new Error('LLM response did not include expected tool_use block')
    }

    const toolInput = toolUseBlock.input as TimelineToolInput
    if (!Array.isArray(toolInput.events)) {
      throw new Error('LLM tool input did not contain a valid events array')
    }

    return [...toolInput.events].sort((a, b) => a.year - b.year)
  }
}

function zoomToSpecificityInstruction(zoom: number | undefined): string {
  if (zoom === undefined || zoom <= 2) {
    return 'Focus on broad continental and world-historical civilizations and events for this region of the globe — ancient empires, migration epochs, and turning points that shaped this part of the world.'
  }
  if (zoom <= 5) {
    return 'Focus on the national history of the country at these coordinates — major political events, wars, founding moments, and nationally significant cultural milestones.'
  }
  if (zoom <= 8) {
    return 'Focus on regional history at the state, province, or territory level — locally significant events, regional conflicts, economic development, and the cultural history of this region.'
  }
  if (zoom <= 11) {
    return 'Focus on city and town history — the founding and growth of this settlement, major local events, notable figures from this city, and culturally significant local milestones.'
  }
  if (zoom <= 14) {
    return 'Focus on hyperlocal history — specific neighborhoods, districts, historical streets, and known landmarks at or near this exact location.'
  }
  return 'Focus on the specific building, monument, park, institution, or site at or nearest to these exact coordinates. Identify what is physically present at this location and describe its history in detail — when it was built or established, notable events that occurred there, and its historical significance.'
}

/**
 * Builds the location label passed to the LLM, stripping detail to match the zoom scope.
 *
 * At low zoom the geocoder often returns a sub-regional name (e.g. "Great Basin, Nevada, USA")
 * which anchors the LLM to that place even when the user expects country-level history.
 * We fix this by only exposing the level of granularity that matches the current scope:
 *   world/continental  → country only
 *   national           → country only (coordinates already establish continent)
 *   regional           → region + country
 *   city+              → full placeLabel with all components
 */
function buildLocationContext(input: TimelinePromptInput): string {
  const zoom = input.zoom

  if (zoom === undefined || zoom <= 5) {
    // World / national scope — only the country name matters
    return input.country ?? input.placeLabel
  }

  if (zoom <= 8) {
    // Regional scope — region + country, no street-level detail
    const parts = [input.region, input.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : input.placeLabel
  }

  // City and below — use the full geocoded label with all components
  const parts = [input.city, input.region, input.country].filter(Boolean)
  return parts.length > 0 ? `${input.placeLabel} (${parts.join(', ')})` : input.placeLabel
}
