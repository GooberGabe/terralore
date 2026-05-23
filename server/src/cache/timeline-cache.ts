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

// --- In-memory implementation ---

export class InMemoryTimelineCache implements TimelineCache {
  private readonly store = new Map<string, CachedTimeline>()

  async get(key: string): Promise<CachedTimeline | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (new Date(entry.expiresAt) < new Date()) {
      this.store.delete(key)
      return null
    }

    return entry
  }

  async set(entry: CachedTimeline): Promise<void> {
    this.store.set(entry.key, entry)
  }
}
