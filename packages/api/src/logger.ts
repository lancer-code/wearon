import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { repo: 'wearon' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
        },
      }),
})

export function createChildLogger(requestId: string) {
  return logger.child({ request_id: requestId })
}
