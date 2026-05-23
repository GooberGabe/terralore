import type { HistoricalEvent, LocationContext, TimelineResponse } from '../../../src/types/index.js'
import type { TimelineCache } from '../cache/timeline-cache.js'
import type { GeocodingProvider } from '../providers/geocoding-provider.js'
import type { LlmProvider } from '../providers/llm-provider.js'

export interface BuildTimelineInput {
  lat: number
  lng: number
  locale?: string
  maxEvents?: number
  zoom?: number
}

export interface TimelineService {
  buildTimeline(input: BuildTimelineInput): Promise<TimelineResponse>
}

const DEFAULT_MAX_EVENTS = 10
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export class TimelineServiceImpl implements TimelineService {
  constructor(
    private readonly geocodingProvider: GeocodingProvider,
    private readonly llmProvider: LlmProvider,
    private readonly cache: TimelineCache,
  ) {}

  async buildTimeline(input: BuildTimelineInput): Promise<TimelineResponse> {
    const maxEvents = input.maxEvents ?? DEFAULT_MAX_EVENTS
    const cacheKey = buildCacheKey(input.lat, input.lng, maxEvents, input.zoom)

    const cached = await this.cache.get(cacheKey)
    if (cached) {
      const payload = JSON.parse(cached.payload) as TimelineResponse
      return { ...payload, cacheHit: true }
    }

    const location = await this.geocodingProvider.reverseGeocode({
      lat: input.lat,
      lng: input.lng,
    })

    const rawEvents = await this.llmProvider.generateTimeline({
      lat: input.lat,
      lng: input.lng,
      placeLabel: location.placeLabel,
      city: location.city,
      region: location.region,
      country: location.country,
      maxEvents,
      zoom: input.zoom,
    })

    const events: HistoricalEvent[] = rawEvents.map((e, idx) => ({
      id: `${cacheKey}:${idx}`,
      title: e.title,
      summary: e.summary,
      dateLabel: e.dateLabel,
      year: e.year,
      confidence: e.confidence,
      significanceScore: e.significanceScore,
      sources: e.sources,
    }))

    const locationContext: LocationContext = {
      coordinates: { lat: input.lat, lng: input.lng },
      placeLabel: location.placeLabel,
      city: location.city,
      region: location.region,
      country: location.country,
    }

    const response: TimelineResponse = {
      location: locationContext,
      events,
      generatedAt: new Date().toISOString(),
      cacheHit: false,
    }

    const now = Date.now()
    await this.cache.set({
      key: cacheKey,
      payload: JSON.stringify(response),
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
    })

    return response
  }
}

/**
 * Rounds coordinates to ~1km precision to group nearby pins into the same cache bucket.
 * Zoom is bucketed into four specificity tiers so minor zoom changes don't bust the cache.
 */
function buildCacheKey(lat: number, lng: number, maxEvents: number, zoom: number | undefined): string {
  const roundedLat = Math.round(lat * 100) / 100
  const roundedLng = Math.round(lng * 100) / 100
  const zoomBucket = zoom === undefined || zoom <= 5 ? 'r' : zoom <= 9 ? 'c' : zoom <= 13 ? 'l' : 'h'
  return `timeline:${roundedLat}:${roundedLng}:${maxEvents}:${zoomBucket}`
}
