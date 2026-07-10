import { Router } from 'express'

import type { TimeRange } from '../../../src/types/index.js'
import type { TimelineService } from '../services/timeline-service.js'

import { MIN_EVENTS, MAX_EVENTS } from '../lib/event-count.js'

export function registerTimelineRoutes(router: Router, service: TimelineService): void {
  router.post('/timeline', async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>
      const { lat, lng, maxEvents, locale } = body

      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        res.status(400).json({ error: 'lat must be a number between -90 and 90' })
        return
      }

      if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        res.status(400).json({ error: 'lng must be a number between -180 and 180' })
        return
      }

      if (maxEvents !== undefined) {
        if (
          typeof maxEvents !== 'number' ||
          !Number.isInteger(maxEvents) ||
          maxEvents < MIN_EVENTS ||
          maxEvents > MAX_EVENTS
        ) {
          res
            .status(400)
            .json({ error: `maxEvents must be an integer between ${MIN_EVENTS} and ${MAX_EVENTS}` })
          return
        }
      }

      if (locale !== undefined && typeof locale !== 'string') {
        res.status(400).json({ error: 'locale must be a string' })
        return
      }

      const { zoom } = body
      if (zoom !== undefined) {
        if (typeof zoom !== 'number' || !Number.isInteger(zoom) || zoom < 0 || zoom > 22) {
          res.status(400).json({ error: 'zoom must be an integer between 0 and 22' })
          return
        }
      }

      const { timeRange } = body
      let validatedTimeRange: TimeRange | undefined
      if (timeRange !== undefined) {
        if (typeof timeRange !== 'object' || timeRange === null) {
          res.status(400).json({ error: 'timeRange must be an object' })
          return
        }
        const tr = timeRange as Record<string, unknown>
        if (tr['type'] === 'range') {
          const { startYear, endYear } = tr
          if (
            typeof startYear !== 'number' || !Number.isInteger(startYear) ||
            typeof endYear !== 'number' || !Number.isInteger(endYear) ||
            startYear >= endYear
          ) {
            res.status(400).json({ error: 'timeRange.startYear and endYear must be integers with startYear < endYear' })
            return
          }
          validatedTimeRange = { type: 'range', startYear, endYear }
        } else if (tr['type'] === 'all') {
          validatedTimeRange = { type: 'all' }
        } else {
          res.status(400).json({ error: 'timeRange.type must be "all" or "range"' })
          return
        }
      }

      const result = await service.buildTimeline({
        lat,
        lng,
        maxEvents: maxEvents as number | undefined,
        locale: locale as string | undefined,
        zoom: zoom as number | undefined,
        timeRange: validatedTimeRange,
      })

      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  })
}
