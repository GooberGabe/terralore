import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps'
import { useCallback, useState } from 'react'

import { LocationBadge } from './components/LocationBadge.js'
import { TimelinePanel } from './components/TimelinePanel.js'
import { fetchTimeline } from './services/timelineApi.js'
import type { Coordinates, TimelineResponse } from './types/index.js'
import './App.css'

const MAPS_API_KEY = import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] as string

function App() {
  const [pin, setPin] = useState<Coordinates | null>(null)
  const [zoom, setZoom] = useState(2)
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMapClick = useCallback(
    (ev: { detail: { latLng: { lat: number; lng: number } | null } }) => {
      const latLng = ev.detail.latLng
      if (!latLng) return

      const coords: Coordinates = { lat: latLng.lat, lng: latLng.lng }
      setPin(coords)
      setTimeline(null)
      setError(null)
      setLoading(true)

      fetchTimeline({ coordinates: coords, zoom })
        .then((result) => {
          setTimeline(result)
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Something went wrong')
        })
        .finally(() => {
          setLoading(false)
        })
    },
    [zoom],
  )
  return (
    <div className="app">
      <APIProvider apiKey={MAPS_API_KEY}>
        <Map
          className="app__map"
          defaultCenter={{ lat: 20, lng: 10 }}
          defaultZoom={2}
          gestureHandling="greedy"
          mapId="terralore-map"
          onClick={handleMapClick}
          onCameraChanged={(ev: { detail: { zoom: number } }) => {
            setZoom(Math.round(ev.detail.zoom))
          }}
        >
          {pin && <AdvancedMarker position={pin} />}
        </Map>
      </APIProvider>

      <aside className="app__sidebar">
        {pin && <LocationBadge coordinates={pin} location={timeline?.location ?? null} />}
        <TimelinePanel loading={loading} error={error} timeline={timeline} />
      </aside>
    </div>
  )
}

export default App
