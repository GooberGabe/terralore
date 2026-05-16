import { Router } from 'express'

export function registerTimelineRoutes(router: Router): void {
  router.get('/timeline', (_req, res) => {
    res.status(501).json({
      message: 'Timeline endpoint stubbed. Implement service orchestration next.',
    })
  })
}
