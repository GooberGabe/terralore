export interface TimelinePromptInput {
  placeLabel: string
  city?: string
  region?: string
  country?: string
  maxEvents: number
}

export interface RankedHistoricalEvent {
  title: string
  summary: string
  dateLabel: string
  significanceScore: number
  confidence: number
  sources: string[]
}

export interface LlmProvider {
  generateTimeline(input: TimelinePromptInput): Promise<RankedHistoricalEvent[]>
}
