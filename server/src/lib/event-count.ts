/**
 * Estimates how many timeline events to request for a given location.
 *
 * Two signals are combined:
 *  1. Place type (from the Google Geocoding `types` array) — reflects the category
 *     of the place and its likely historical richness.
 *  2. Zoom level — reflects the user's intended scope (wider = more events).
 *
 * Returns an integer in [MIN_EVENTS, MAX_EVENTS].
 */

export const MIN_EVENTS = 1
export const MAX_EVENTS = 12

/**
 * Base scores by Google Geocoding place type.
 * Higher score = historically richer category = more events.
 */
const TYPE_SCORES: Readonly<Record<string, number>> = {
  country: 11,
  administrative_area_level_1: 9,  // state / province
  administrative_area_level_2: 8,  // county / district
  locality: 7,                      // city / town
  sublocality: 5,
  sublocality_level_1: 5,
  neighborhood: 4,
  tourist_attraction: 7,            // explicitly notable places
  natural_feature: 6,               // mountains, rivers, coastlines, etc.
  park: 5,
  museum: 6,
  place_of_worship: 5,
  university: 5,
  point_of_interest: 5,
  establishment: 3,
  route: 2,                         // street / road
  premise: 2,
}

const DEFAULT_TYPE_SCORE = 5

function scoreFromTypes(placeTypes: string[]): number {
  let best = DEFAULT_TYPE_SCORE
  for (const t of placeTypes) {
    const s = TYPE_SCORES[t]
    if (s !== undefined && s > best) best = s
  }
  return best
}

/**
 * Zoom modifier: wider view → request more events; tighter view → fewer.
 * Mirrors the scope buckets already used by the cache key builder.
 */
function modifierFromZoom(zoom?: number): number {
  if (zoom === undefined) return 0
  if (zoom <= 2) return 2   // world / continental
  if (zoom <= 5) return 1   // national
  if (zoom <= 8) return 0   // regional
  if (zoom <= 11) return -1  // city
  if (zoom <= 14) return -2  // neighborhood / local
  return -3                  // point-of-interest / building
}

export function estimateEventCount(placeTypes: string[], zoom?: number): number {
  const raw = scoreFromTypes(placeTypes) + modifierFromZoom(zoom)
  return Math.min(MAX_EVENTS, Math.max(MIN_EVENTS, raw))
}
