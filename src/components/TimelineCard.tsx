import type { HistoricalEvent } from '../types/index.js'

interface TimelineCardProps {
  event: HistoricalEvent
}

export function TimelineCard({ event }: TimelineCardProps) {
  const significancePct = Math.round(event.significanceScore * 100)
  const confidencePct = Math.round(event.confidence * 100)

  return (
    <article className="timeline-card">
      <header className="timeline-card__header">
        <span className="timeline-card__date">{event.dateLabel}</span>
        <div className="timeline-card__scores">
          <span className="timeline-card__score" title="Significance">
            ★ {significancePct}%
          </span>
          <span className="timeline-card__score timeline-card__score--confidence" title="Confidence">
            ✓ {confidencePct}%
          </span>
        </div>
      </header>

      <h3 className="timeline-card__title">{event.title}</h3>
      <p className="timeline-card__summary">{event.summary}</p>

      {event.sources.length > 0 && (
        <footer className="timeline-card__sources">
          <span className="timeline-card__sources-label">Sources: </span>
          {event.sources.join('; ')}
        </footer>
      )}
    </article>
  )
}
