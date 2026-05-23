import type { HistoricalEvent } from '../types/index.js'

interface TimelineBarProps {
  events: HistoricalEvent[]
  activeIndex: number
  onDotClick: (index: number) => void
}

export function TimelineBar({ events, activeIndex, onDotClick }: TimelineBarProps) {
  if (events.length === 0) return null

  const total = events.length

  // Ordinal spacing: each event gets equal real estate on the bar regardless of
  // the calendar gap between events. Dates are preserved as dot tooltips.
  function dotPercent(index: number): number {
    if (total <= 1) return 50
    return (index / (total - 1)) * 100
  }

  const fillPercent = total <= 1 ? 0 : (activeIndex / (total - 1)) * 100

  return (
    <div className="timeline-bar">
      <div className="timeline-bar__track">
        <div className="timeline-bar__fill" style={{ width: `${fillPercent}%` }} />
        {events.map((event, index) => (
          <div
            key={event.id}
            className={`timeline-bar__dot${index === activeIndex ? ' timeline-bar__dot--active' : ''}`}
            style={{ left: `${dotPercent(index)}%` }}
            title={event.dateLabel}
            role="button"
            tabIndex={0}
            onClick={() => onDotClick(index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDotClick(index) }}
          />
        ))}
      </div>
      <div className="timeline-bar__labels">
        <span>{formatYear(events[0].year)}</span>
        <span>{formatYear(events[total - 1].year)}</span>
      </div>
    </div>
  )
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`
  return String(year)
}
