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
