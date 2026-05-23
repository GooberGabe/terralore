export type ISODateString = string

export interface Coordinates {
  lat: number
  lng: number
}

export interface LocationContext {
  coordinates: Coordinates
  city?: string
  region?: string
  country?: string
  placeLabel: string
}

export interface HistoricalEvent {
  id: string
  title: string
  summary: string
  dateLabel: string
  year: number
  startDate?: ISODateString
  endDate?: ISODateString
  confidence: number
  significanceScore: number
  sources: string[]
}

export interface TimelineRequest {
  coordinates: Coordinates
  locale?: string
  maxEvents?: number
  zoom?: number
}

export interface TimelineResponse {
  location: LocationContext
  events: HistoricalEvent[]
  generatedAt: ISODateString
  cacheHit: boolean
}

export interface ProviderFailure {
  provider: 'geocoding' | 'llm' | 'cache'
  message: string
  retryable: boolean
}
