import type { TimelineResponse } from '../types/index.js'
import { TimelineCard } from './TimelineCard.js'

interface TimelinePanelProps {
  loading: boolean
  error: string | null
  timeline: TimelineResponse | null
}

export function TimelinePanel({ loading, error, timeline }: TimelinePanelProps) {
  if (loading) {
    return (
      <div className="timeline-panel timeline-panel--loading">
        <div className="timeline-panel__spinner" aria-label="Loading timeline" />
        <p>Generating timeline…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="timeline-panel timeline-panel--error" role="alert">
        <p className="timeline-panel__error-msg">{error}</p>
      </div>
    )
  }

  if (!timeline) {
    return (
      <div className="timeline-panel timeline-panel--empty">
        <p>Drop a pin on the map to generate a historical timeline.</p>
      </div>
    )
  }

  const { events, generatedAt, cacheHit } = timeline

  return (
    <section className="timeline-panel">
      <header className="timeline-panel__meta">
        <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
        <span>{cacheHit ? 'Cached' : 'Generated'} · {new Date(generatedAt).toLocaleTimeString()}</span>
      </header>

      {events.length === 0 ? (
        <p className="timeline-panel__empty-events">No events found for this location.</p>
      ) : (
        <ol className="timeline-panel__list">
          {events.map((event, index) => (
            <li key={event.id} data-event-index={index}>
              <TimelineCard event={event} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
