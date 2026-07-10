import cors from 'cors'
import 'dotenv/config'
import express from 'express'

import { InMemoryTimelineCache } from './cache/index.js'
import { getServerEnv } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { AnthropicLlmProvider, GoogleGeocodingProvider } from './providers/index.js'
import { createApiRouter } from './routes/index.js'
import { TimelineServiceImpl } from './services/timeline-service.js'

const env = getServerEnv()

const geocodingProvider = new GoogleGeocodingProvider(env.googleGeocodingApiKey)
const llmProvider = new AnthropicLlmProvider(env.anthropicApiKey, env.anthropicModel)
const geoCache = new InMemoryTimelineCache()
const timelineCache = new InMemoryTimelineCache()
const timelineService = new TimelineServiceImpl(geocodingProvider, llmProvider, timelineCache, {
  dryRunLlm: env.debugDryRunLlm,
  geocodingCache: geoCache,
})

const app = express()

app.use(cors({
  origin: env.allowedOrigins.length > 0
    ? env.allowedOrigins
    : env.nodeEnv === 'production'
      ? false
      : true,
}))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'terralore-server' })
})

app.use('/api', createApiRouter(timelineService))
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Terralore server listening on http://localhost:${env.port}`)
})
