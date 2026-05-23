import { Router } from 'express'

import type { TimelineService } from '../services/timeline-service.js'
import { registerTimelineRoutes } from './timeline.js'

export function createApiRouter(service: TimelineService): Router {
  const router = Router()

  registerTimelineRoutes(router, service)

  return router
}
