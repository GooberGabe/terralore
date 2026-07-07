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
  description: 'Submit the ranked list of historical events.',
  input_schema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        description: 'Historical events, most significant first.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title.' },
            summary: {
              type: 'string',
              description: '1–2 sentence description.',
            },
            dateLabel: {
              type: 'string',
              description: 'Human-readable date (e.g. "circa 1200 BCE", "May 1453").',
            },
            year: {
              type: 'number',
              description: 'Approximate year as integer; negative for BCE.',
            },
            significanceScore: {
              type: 'number',
              description: 'Significance 0.0–1.0.',
            },
            confidence: {
              type: 'number',
              description: 'Accuracy confidence 0.0–1.0.',
            },
            sources: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 2,
              description: 'Up to 2 reference sources (e.g. book titles, Wikipedia articles).',
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
      `Return up to ${input.maxEvents} historically significant events for:\n` +
      `  Name: ${locationContext}\n` +
      `  Coordinates: ${input.lat.toFixed(4)}°, ${input.lng.toFixed(4)}°\n` +
      poiLine +
      `\n` +
      `${specificityInstruction} Rank by significance. Include a mix of eras where applicable.`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

    let message: Anthropic.Message
    try {
      message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 2048,
          system:
            'You are a historical research assistant. Return accurate events strictly for the exact location provided — never substitute or borrow from nearby places, even for remote or sparsely documented locations. Return only what you can genuinely attribute to this location. Use the provided tool to submit.',
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
