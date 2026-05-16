export interface BuildTimelineInput {
  lat: number
  lng: number
  locale?: string
  maxEvents?: number
}

export interface BuildTimelineResult {
  locationLabel: string
  eventsCount: number
  cacheHit: boolean
}

export interface TimelineService {
  buildTimeline(input: BuildTimelineInput): Promise<BuildTimelineResult>
}
