export interface CachedTimeline {
  key: string
  payload: string
  cachedAt: string
  expiresAt: string
}

export interface TimelineCache {
  get(key: string): Promise<CachedTimeline | null>
  set(entry: CachedTimeline): Promise<void>
}
