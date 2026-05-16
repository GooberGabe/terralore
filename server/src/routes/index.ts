import { Router } from 'express'

import { registerTimelineRoutes } from './timeline.js'

export function createApiRouter(): Router {
  const router = Router()

  registerTimelineRoutes(router)

  return router
}
