import type { Coordinates, LocationContext } from '../types/index.js'

interface LocationBadgeProps {
  coordinates: Coordinates
  location: LocationContext | null
}

export function LocationBadge({ coordinates, location }: LocationBadgeProps) {
  const label = location?.placeLabel ?? 'Resolving location…'
  const lat = coordinates.lat.toFixed(4)
  const lng = coordinates.lng.toFixed(4)

  return (
    <div className="location-badge">
      <div className="location-badge__label">{label}</div>
      <div className="location-badge__coords">
        {lat}, {lng}
      </div>
    </div>
  )
}
