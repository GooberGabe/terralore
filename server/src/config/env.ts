export interface ServerEnv {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
  googleGeocodingApiKey: string
  anthropicApiKey: string
  anthropicModel: string
  /** When true, skips LLM calls and returns empty events (useful for debugging geocoding/scoring). */
  debugDryRunLlm: boolean
  /**
   * Comma-separated list of allowed CORS origins (e.g. "https://terralore.onrender.com").
   * When empty, defaults to permissive in development and blocks all cross-origin in production.
   */
  allowedOrigins: string[]
}

function parsePort(raw: string | undefined): number {
  const parsed = Number(raw ?? '8787')

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 8787
  }

  return parsed
}

function parseNodeEnv(raw: string | undefined): ServerEnv['nodeEnv'] {
  if (raw === 'test' || raw === 'production') {
    return raw
  }

  return 'development'
}

function requireEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getServerEnv(): ServerEnv {
  return {
    port: parsePort(process.env.PORT),
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    googleGeocodingApiKey: requireEnvVar('GOOGLE_GEOCODING_API_KEY'),
    anthropicApiKey: requireEnvVar('ANTHROPIC_API_KEY'),
    anthropicModel: process.env['ANTHROPIC_MODEL'] ?? 'claude-3-5-sonnet-20241022',
    debugDryRunLlm: process.env['DEBUG_DRY_RUN_LLM'] === 'true',
    allowedOrigins: process.env['ALLOWED_ORIGINS']
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  }
}
