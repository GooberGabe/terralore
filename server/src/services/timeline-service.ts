import type { HistoricalEvent, LocationContext, TimelineResponse, TimeRange } from '../../../src/types/index.js'
import type { TimelineCache } from '../cache/timeline-cache.js'
import type { GeocodedLocation, GeocodingProvider } from '../providers/geocoding-provider.js'
import type { LlmProvider } from '../providers/llm-provider.js'
import { diagnoseEventCount } from '../lib/event-count.js'

export interface BuildTimelineInput {
  lat: number
  lng: number
  locale?: string
  maxEvents?: number
  zoom?: number
  timeRange?: TimeRange
}

export interface TimelineService {
  buildTimeline(input: BuildTimelineInput): Promise<TimelineResponse>
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000      // 24 hours — timeline entries
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days  — geocoding entries (data is stable)

export interface TimelineServiceOptions {
  /** When true, skips LLM calls and returns empty events. Useful for debugging geocoding and scoring. */
  dryRunLlm?: boolean
  /**
   * Separate cache store for geocoding results. Defaults to the timeline cache store when omitted,
   * using a distinct key prefix to avoid collisions. Provide a dedicated instance for independent TTL control.
   */
  geocodingCache?: TimelineCache
}

export class TimelineServiceImpl implements TimelineService {
  private readonly dryRunLlm: boolean
  private readonly geocodingCache: TimelineCache

  constructor(
    private readonly geocodingProvider: GeocodingProvider,
    private readonly llmProvider: LlmProvider,
    private readonly cache: TimelineCache,
    options: TimelineServiceOptions = {},
  ) {
    this.dryRunLlm = options.dryRunLlm ?? false
    this.geocodingCache = options.geocodingCache ?? cache
  }

  async buildTimeline(input: BuildTimelineInput): Promise<TimelineResponse> {
    // --- Geocoding (with cache) ---
    // Check geocoding cache before calling the provider so repeated requests
    // for the same location+scope never pay the geocoding API cost twice.
    const geoCacheKey = buildGeoCacheKey(input.lat, input.lng, input.zoom)
    const cachedGeo = await this.geocodingCache.get(geoCacheKey)
    let location: GeocodedLocation
    if (cachedGeo) {
      location = JSON.parse(cachedGeo.payload) as GeocodedLocation
    } else {
      location = await this.geocodingProvider.reverseGeocode({
        lat: input.lat,
        lng: input.lng,
        zoom: input.zoom,
      })
      const geoNow = Date.now()
      await this.geocodingCache.set({
        key: geoCacheKey,
        payload: JSON.stringify(location),
        cachedAt: new Date(geoNow).toISOString(),
        expiresAt: new Date(geoNow + GEO_CACHE_TTL_MS).toISOString(),
      })
    }

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

    const cacheKey = buildTimelineCacheKey(location, input.zoom, input.timeRange, input.locale)

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
      console.debug('[cache] HIT  key=%s', cacheKey)
      const payload = JSON.parse(cached.payload) as TimelineResponse
      return { ...payload, cacheHit: true }
    }
    console.debug('[cache] MISS key=%s', cacheKey)

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
      timeRange: input.timeRange,
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
function buildGeoCacheKey(lat: number, lng: number, zoom: number | undefined): string {
  const bucket = zoomToScopeBucket(zoom)
  const precision = zoomToCoordPrecision(zoom)
  const factor = Math.pow(10, precision)
  const roundedLat = Math.round(lat * factor) / factor
  const roundedLng = Math.round(lng * factor) / factor
  return `geo:${roundedLat}:${roundedLng}:${bucket}`
}

/**
 * Builds the timeline cache key from the **structured semantic fields** returned
 * by geocoding (country, region, city, pointOfInterest) rather than from raw
 * coordinates or the formatted_address string.
 *
 * Why not coordinates? Two clicks 800 m apart in the same city can straddle a
 * rounding boundary and produce different coordinate keys.
 *
 * Why not placeLabel (formatted_address)? Google returns the most-specific
 * address first, so nearby clicks land on different streets and produce
 * different formatted_address strings ("Rue de Rivoli…" vs "Blvd Haussmann…")
 * even though both are queries about Paris.
 *
 * Why not maxEvents? The primary geocode result type varies by click location
 * (route vs establishment vs locality), shifting the estimate by 1–2 and
 * fragmenting the key unnecessarily. Since maxEvents is an internal estimate
 * (not user-supplied), omitting it from the key is safe.
 *
 * Scope bucket is included because the same city at different zoom levels
 * (regional vs city vs local) produces semantically different queries.
 */
function buildTimelineCacheKey(
  location: GeocodedLocation,
  zoom: number | undefined,
  timeRange: TimeRange | undefined,
  locale: string | undefined,
): string {
  const bucket = zoomToScopeBucket(zoom)
  // Normalize: strip diacritics, lowercase, collapse non-alphanumeric to '_'
  const n = (s: string | undefined): string =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

  // At wide zoom levels, clicking anywhere within a country still geocodes to
  // a specific city/region based on exact coordinates, even though the user
  // is querying about the country/region as a whole. Include only the fields
  // that are semantically relevant at each zoom scope.
  let placeKey: string
  switch (bucket) {
    case 'w': // world (≤2): country only (or empty for ocean)
    case 'n': // national (3–5): country only
      placeKey = n(location.country)
      break
    case 'r': // regional (6–8): country + region
      placeKey = `${n(location.country)}:${n(location.region)}`
      break
    case 'c': // city (9–11): country + region + city
      placeKey = `${n(location.country)}:${n(location.region)}:${n(location.city)}`
      break
    case 'l': // local (12–14): country + region + city + neighborhood
      placeKey = `${n(location.country)}:${n(location.region)}:${n(location.city)}:${n(location.neighborhood)}`
      break
    default: // poi (15+): country + region + city + neighborhood + poi
      placeKey = `${n(location.country)}:${n(location.region)}:${n(location.city)}:${n(location.neighborhood)}:${n(location.pointOfInterest)}`
      break
  }
  const rangeSegment = timeRange?.type === 'range'
    ? `:${timeRange.startYear}-${timeRange.endYear}`
    : ':all'
  const localeSegment = locale ? `:${locale}` : ':default'
  return `timeline:${placeKey}:${bucket}${rangeSegment}${localeSegment}`
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
