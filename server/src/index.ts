import cors from 'cors'
import 'dotenv/config'
import express from 'express'

import { getServerEnv } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { createApiRouter } from './routes/index.js'

const app = express()
const env = getServerEnv()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'terralore-server' })
})

app.use('/api', createApiRouter())
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Terralore server listening on http://localhost:${env.port}`)
})
