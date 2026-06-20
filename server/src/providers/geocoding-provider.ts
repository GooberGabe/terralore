export interface ReverseGeocodeInput {
  lat: number
  lng: number
  zoom?: number
}

export interface GeocodedLocation {
  placeLabel: string
  city?: string
  region?: string
  country?: string
  pointOfInterest?: string
  placeTypes: string[]
}

export interface GeocodingProvider {
  reverseGeocode(input: ReverseGeocodeInput): Promise<GeocodedLocation>
}

// --- Google Geocoding API implementation ---

interface GoogleAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GoogleGeocodeResult {
  formatted_address: string
  address_components: GoogleAddressComponent[]
  types: string[]
}

interface GoogleGeocodeResponse {
  status: string
  results: GoogleGeocodeResult[]
  error_message?: string
}

const GEOCODE_TIMEOUT_MS = 10_000

export class GoogleGeocodingProvider implements GeocodingProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async reverseGeocode(input: ReverseGeocodeInput): Promise<GeocodedLocation> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${input.lat},${input.lng}`)
    url.searchParams.set('key', this.apiKey)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(url.toString(), { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      throw new Error(`Geocoding HTTP error: ${response.status}`)
    }

    const data = (await response.json()) as GoogleGeocodeResponse

    if (data.status !== 'OK' || data.results.length === 0) {
      throw new Error(`Geocoding failed: ${data.status}`)
    }

    return normalizeGeocodeResult(data.results, input.zoom)
  }
}

const POI_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'natural_feature',
  'park',
  'premise',
  'tourist_attraction',
  'museum',
  'place_of_worship',
  'university',
  'hospital',
  'stadium',
])

function getComponent(
  components: GoogleAddressComponent[],
  type: string,
): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name
}

function normalizeGeocodeResult(
  results: GoogleGeocodeResult[],
  zoom?: number,
): GeocodedLocation {
  const primary = results[0]
  const components = primary.address_components
  const city =
    getComponent(components, 'locality') ??
    getComponent(components, 'sublocality') ??
    getComponent(components, 'administrative_area_level_2')
  const region = getComponent(components, 'administrative_area_level_1')
  const country = getComponent(components, 'country')

  let pointOfInterest: string | undefined
  if (zoom !== undefined && zoom > 13) {
    const poiResult = results.find((r) => r.types.some((t) => POI_TYPES.has(t)))
    if (poiResult) {
      const firstName = poiResult.formatted_address.split(',')[0].trim()
      // Only use if it looks like a named place, not a bare street number
      if (firstName && !/^\d+\s/.test(firstName) && !/^\d+$/.test(firstName)) {
        pointOfInterest = firstName
      }
    }
  }

  return {
    placeLabel: primary.formatted_address,
    city,
    region,
    country,
    pointOfInterest,
    placeTypes: primary.types,
  }
}
