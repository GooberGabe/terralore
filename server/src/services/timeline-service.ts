import type { HistoricalEvent, LocationContext, TimelineResponse } from '../../../src/types/index.js'
import type { TimelineCache } from '../cache/timeline-cache.js'
import type { GeocodingProvider } from '../providers/geocoding-provider.js'
import type { LlmProvider } from '../providers/llm-provider.js'
import { diagnoseEventCount } from '../lib/event-count.js'

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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface TimelineServiceOptions {
  /** When true, skips LLM calls and returns empty events. Useful for debugging geocoding and scoring. */
  dryRunLlm?: boolean
}

export class TimelineServiceImpl implements TimelineService {
  private readonly dryRunLlm: boolean

  constructor(
    private readonly geocodingProvider: GeocodingProvider,
    private readonly llmProvider: LlmProvider,
    private readonly cache: TimelineCache,
    options: TimelineServiceOptions = {},
  ) {
    this.dryRunLlm = options.dryRunLlm ?? false
  }

  async buildTimeline(input: BuildTimelineInput): Promise<TimelineResponse> {
    // Geocode first so place types are available for event-count estimation.
    const location = await this.geocodingProvider.reverseGeocode({
      lat: input.lat,
      lng: input.lng,
      zoom: input.zoom,
    })

    const isOverride = input.maxEvents !== undefined
    const diag = diagnoseEventCount(location.placeTypes, input.zoom)
    const maxEvents = input.maxEvents ?? diag.estimate

    const deviationStr = diag.typeDeviation >= 0 ? `+${diag.typeDeviation}` : `${diag.typeDeviation}`
    console.debug(
      '[event-count] placeLabel=%s zoom=%s source=%s maxEvents=%d\n' +
      '  placeTypes   : %s\n' +
      '  scoredTypes  : %s\n' +
      '  winningType  : %s (typeScore=%d  deviation=%s)\n' +
      '  zoomBase     : %d  typeWeight=%s\n' +
      '  rawScore     : %d  →  estimate=%d%s',
      location.placeLabel,
      input.zoom ?? '(none)',
      isOverride ? 'override' : 'estimated',
      maxEvents,
      location.placeTypes.join(', ') || '(none)',
      diag.scoredTypes.map((s) => `${s.type}:${s.score}`).join(', ') || '(none)',
      diag.winningType,
      diag.typeScore,
      deviationStr,
      diag.zoomBase,
      diag.typeWeight.toFixed(2),
      diag.rawScore,
      diag.estimate,
      isOverride ? `  [overridden → ${maxEvents}]` : '',
    )

    const cacheKey = buildCacheKey(input.lat, input.lng, maxEvents, input.zoom)

    // --- Dry-run mode: return location + scoring data, skip LLM and cache ---
    if (this.dryRunLlm) {
      console.debug('[event-count] DRY RUN — LLM call skipped')
      return {
        location: {
          coordinates: { lat: input.lat, lng: input.lng },
          placeLabel: location.placeLabel,
          city: location.city,
          region: location.region,
          country: location.country,
          pointOfInterest: location.pointOfInterest,
        },
        events: [],
        generatedAt: new Date().toISOString(),
        cacheHit: false,
      }
    }

    const cached = await this.cache.get(cacheKey)
    if (cached) {
      const payload = JSON.parse(cached.payload) as TimelineResponse
      return { ...payload, cacheHit: true }
    }

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
