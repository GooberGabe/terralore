import type { TimelineRequest, TimelineResponse } from '../types/index.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export interface ApiError {
  error: string
}

export class TimelineApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'TimelineApiError'
    this.status = status
  }
}

export async function fetchTimeline(request: TimelineRequest): Promise<TimelineResponse> {
  const response = await fetch(`${API_BASE}/api/timeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: request.coordinates.lat,
      lng: request.coordinates.lng,
      maxEvents: request.maxEvents,
      locale: request.locale,
      zoom: request.zoom,
    }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: 'Unknown error' }))) as ApiError
    throw new TimelineApiError(response.status, body.error ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<TimelineResponse>
}
