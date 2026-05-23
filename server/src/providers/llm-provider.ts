import Anthropic from '@anthropic-ai/sdk'

export interface TimelinePromptInput {
  placeLabel: string
  city?: string
  region?: string
  country?: string
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
    const locationParts = [input.city, input.region, input.country].filter(Boolean)
    const locationContext =
      locationParts.length > 0 ? `${input.placeLabel} (${locationParts.join(', ')})` : input.placeLabel

    const specificityInstruction = zoomToSpecificityInstruction(input.zoom)

    const userPrompt =
      `Generate a timeline of up to ${input.maxEvents} historically significant events for: ${locationContext}.\n` +
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
            'You are a historical research assistant. Provide accurate, well-sourced historical events for the requested location. ' +
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
  if (zoom === undefined || zoom <= 5) {
    return 'Focus on broad continental or regional historical events and civilizations.'
  }
  if (zoom <= 9) {
    return 'Focus on national and regional historical events for this country or territory.'
  }
  if (zoom <= 13) {
    return 'Focus on city-level and local historical events — founding, major local events, cultural significance.'
  }
  return 'Focus on hyperlocal history — specific neighborhoods, landmarks, buildings, or streets at or near this exact location.'
}
