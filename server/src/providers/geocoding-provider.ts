export interface ReverseGeocodeInput {
  lat: number
  lng: number
}

export interface GeocodedLocation {
  placeLabel: string
  city?: string
  region?: string
  country?: string
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

    return normalizeGeocodeResult(data.results[0])
  }
}

function getComponent(
  components: GoogleAddressComponent[],
  type: string,
): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name
}

function normalizeGeocodeResult(result: GoogleGeocodeResult): GeocodedLocation {
  const components = result.address_components
  const city =
    getComponent(components, 'locality') ??
    getComponent(components, 'sublocality') ??
    getComponent(components, 'administrative_area_level_2')
  const region = getComponent(components, 'administrative_area_level_1')
  const country = getComponent(components, 'country')

  return {
    placeLabel: result.formatted_address,
    city,
    region,
    country,
  }
}
