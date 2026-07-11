/**
 * Estimates how many timeline events to request for a given location.
 *
 * Formula: raw = round(zoomBase × 1.5) + round(typeDeviation × typeWeight)
 *
 *  zoomBase     — scope-anchored baseline; what a typical location at this
 *                 zoom level warrants, independent of what was clicked.
 *  typeDeviation — how much better/worse than average the winning place type
 *                 is (typeScore − DEFAULT_TYPE_SCORE).
 *  typeWeight   — zoom-dependent multiplier that scales the type signal:
 *                 low at world zoom (type barely matters when you click
 *                 ocean), high at POI zoom (type is the primary signal).
 *
 * Returns an integer in [MIN_EVENTS, MAX_EVENTS].
 */

export const MIN_EVENTS = 1
export const MAX_EVENTS = 12

export interface EventCountDiagnostic {
  /** All place types returned by the geocoder. */
  placeTypes: string[]
  zoom: number | undefined
  /** Geocoder types that matched a known score entry, sorted descending. */
  scoredTypes: Array<{ type: string; score: number }>
  /** The type that contributed the highest (winning) score. */
  winningType: string
  typeScore: number
  /** typeScore − DEFAULT_TYPE_SCORE; how far above/below average the place is. */
  typeDeviation: number
  /** Scope-anchored baseline count for this zoom level. */
  zoomBase: number
  /** 0–1 weight applied to typeDeviation; increases as zoom increases. */
  typeWeight: number
  rawScore: number
  /** Final value after clamping to [MIN_EVENTS, MAX_EVENTS] */
  estimate: number
}

/**
 * Base scores by Google Geocoding place type
 * Higher score = historically richer category = more events
 */
const TYPE_SCORES: Readonly<Record<string, number>> = {
  country: 11,
  administrative_area_level_1: 9,  // state / province
  administrative_area_level_2: 8,  // county / district
  locality: 7,                      // city / town
  sublocality: 5,
  sublocality_level_1: 5,
  neighborhood: 4,                  // granularity signal, not LLM context
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
  subpremise: 2,
  plus_code: 1,                     // no recognized place, bare grid coordinate
}

const DEFAULT_TYPE_SCORE = 5

function scoreFromTypes(placeTypes: string[]): { winningType: string; score: number; scoredTypes: Array<{ type: string; score: number }> } {
  const scoredTypes: Array<{ type: string; score: number }> = []
  for (const t of placeTypes) {
    const s = TYPE_SCORES[t]
    if (s !== undefined) scoredTypes.push({ type: t, score: s })
  }
  scoredTypes.sort((a, b) => b.score - a.score)

  const winner = scoredTypes[0]
  if (winner === undefined) {
    return { winningType: '(unrecognized)', score: DEFAULT_TYPE_SCORE, scoredTypes }
  }
  return { winningType: winner.type, score: winner.score, scoredTypes }
}

/**
 * Scope-anchored baseline: the event count a typical location at this zoom
 * warrants, before any place-type adjustment.
 */
function zoomBase(zoom?: number): number {
  if (zoom === undefined || zoom <= 2) return 7   // world / continental
  if (zoom <= 5) return 7                          // national
  if (zoom <= 8) return 6                          // regional
  if (zoom <= 11) return 5                         // city
  if (zoom <= 14) return 4                         // neighborhood / local
  return 3                                         // point-of-interest / building
}

/**
 * How strongly the place type deviation shifts the baseline.
 * Increases with zoom: at world scale a random click tells us little;
 * at POI scale the specific place type is the dominant signal.
 */
function typeWeight(zoom?: number): number {
  if (zoom === undefined || zoom <= 2) return 0.0  // world — type ignored, scope dominates
  if (zoom <= 5) return 0.0                         // national — type ignored, scope dominates
  if (zoom <= 8) return 0.4                         // regional
  if (zoom <= 11) return 0.7                        // city
  if (zoom <= 14) return 0.9                        // local
  return 1.0                                        // poi
}

export function diagnoseEventCount(placeTypes: string[], zoom?: number): EventCountDiagnostic {
  const { winningType, score: typeScore, scoredTypes } = scoreFromTypes(placeTypes)
  const typeDeviation = typeScore - DEFAULT_TYPE_SCORE
  const base = zoomBase(zoom)
  const weight = typeWeight(zoom)
  const rawScore = Math.round(base * 1.5) + Math.round(typeDeviation * weight)
  const estimate = Math.min(MAX_EVENTS, Math.max(MIN_EVENTS, rawScore))
  return {
    placeTypes,
    zoom,
    scoredTypes,
    winningType,
    typeScore,
    typeDeviation,
    zoomBase: base,
    typeWeight: weight,
    rawScore,
    estimate,
  }
}

export function estimateEventCount(placeTypes: string[], zoom?: number): number {
  return diagnoseEventCount(placeTypes, zoom).estimate
}
