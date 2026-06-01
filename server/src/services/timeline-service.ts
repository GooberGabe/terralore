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
      zoom: input.zoom,
    })

    const rawEvents = await this.llmProvider.generateTimeline({
      lat: input.lat,
      lng: input.lng,
      placeLabel: location.placeLabel,
      city: location.city,
      region: location.region,
      country: location.country,
      pointOfInterest: location.pointOfInterest,
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
      pointOfInterest: location.pointOfInterest,
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
 * Rounds coordinates to a precision matched to the zoom scope, then appends a scope bucket letter.
 * Coarse precision (1 decimal, ~11 km) at continental/national zoom prevents fragmenting the cache
 * when the user is panning a world-level view. Fine precision (4 decimals, ~11 m) at POI zoom
 * ensures adjacent buildings get distinct cache entries.
 *
 * Scope buckets:
 *   w = world/continental  (zoom 0-2)
 *   n = national           (zoom 3-5)
 *   r = regional           (zoom 6-8)
 *   c = city               (zoom 9-11)
 *   l = local/neighborhood (zoom 12-14)
 *   p = point-of-interest  (zoom 15+)
 */
function buildCacheKey(lat: number, lng: number, maxEvents: number, zoom: number | undefined): string {
  const bucket = zoomToScopeBucket(zoom)
  const precision = zoomToCoordPrecision(zoom)
  const factor = Math.pow(10, precision)
  const roundedLat = Math.round(lat * factor) / factor
  const roundedLng = Math.round(lng * factor) / factor
  return `timeline:${roundedLat}:${roundedLng}:${maxEvents}:${bucket}`
}

function zoomToScopeBucket(zoom: number | undefined): string {
  if (zoom === undefined || zoom <= 2) return 'w'
  if (zoom <= 5) return 'n'
  if (zoom <= 8) return 'r'
  if (zoom <= 11) return 'c'
  if (zoom <= 14) return 'l'
  return 'p'
}

function zoomToCoordPrecision(zoom: number | undefined): number {
  if (zoom === undefined || zoom <= 5) return 1  // ~11 km
  if (zoom <= 11) return 2                       // ~1 km
  if (zoom <= 14) return 3                       // ~110 m
  return 4                                       // ~11 m
}
