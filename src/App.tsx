import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps'
import { useCallback, useRef, useState, type UIEvent } from 'react'

import { LocationBadge } from './components/LocationBadge.js'
import { TimelineBar } from './components/TimelineBar.js'
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
  const [activeEventIndex, setActiveEventIndex] = useState(0)
  const sidebarRef = useRef<HTMLElement>(null)

  const handleMapClick = useCallback(
    (ev: { detail: { latLng: { lat: number; lng: number } | null } }) => {
      const latLng = ev.detail.latLng
      if (!latLng) return

      const coords: Coordinates = { lat: latLng.lat, lng: latLng.lng }
      setPin(coords)
      setTimeline(null)
      setError(null)
      setLoading(true)
      setActiveEventIndex(0)

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

  const handleDotClick = useCallback((index: number) => {
    setActiveEventIndex(index)
    const aside = sidebarRef.current
    if (!aside) return
    const card = aside.querySelector<HTMLElement>(`[data-event-index="${index}"]`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleSidebarScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const aside = e.currentTarget
    const sidebarRect = aside.getBoundingClientRect()
    // A card becomes active once its top edge crosses the upper-third of the sidebar viewport.
    const threshold = sidebarRect.top + sidebarRect.height * 0.33
    const cards = aside.querySelectorAll<HTMLElement>('[data-event-index]')
    let active = 0
    for (const card of cards) {
      if (card.getBoundingClientRect().top <= threshold) {
        active = parseInt(card.dataset['eventIndex'] ?? '0', 10)
      }
    }
    setActiveEventIndex(active)
  }, [])
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

      <aside className="app__sidebar" ref={sidebarRef} onScroll={handleSidebarScroll}>
        <div className="sidebar-header">
          <span className="sidebar-header__title">Terralore</span>
        </div>
        {pin && <LocationBadge coordinates={pin} location={timeline?.location ?? null} />}
        {timeline && <TimelineBar events={timeline.events} activeIndex={activeEventIndex} onDotClick={handleDotClick} />}
        <TimelinePanel loading={loading} error={error} timeline={timeline} />
      </aside>
    </div>
  )
}

export default App
