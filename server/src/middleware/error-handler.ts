import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next
  console.error('[server:error]', err)
  res.status(500).json({ error: 'Internal Server Error' })
}
