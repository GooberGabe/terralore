export interface ServerEnv {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
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

export function getServerEnv(): ServerEnv {
  return {
    port: parsePort(process.env.PORT),
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  }
}
