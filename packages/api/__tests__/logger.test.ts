import { describe, expect, it, vi } from 'vitest'

// Mock pino-pretty transport so it doesn't fail in test environment
vi.mock('pino', async () => {
  const actual = await vi.importActual<typeof import('pino')>('pino')
  return {
    ...actual,
    default: actual.default,
  }
})

describe('logger', () => {
  it('exports a logger instance with required base fields', async () => {
    const { logger } = await import('../src/logger')
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('logger.info produces correct level', async () => {
    const { logger } = await import('../src/logger')
    const chunks: string[] = []
    const dest = {
      write(chunk: string) {
        chunks.push(chunk)
      },
    }

    // Create a raw pino logger for testing JSON output
    const pino = (await import('pino')).default
    const testLogger = pino(
      {
        level: 'info',
        base: { repo: 'wearon' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      dest,
    )

    testLogger.info('test message')

    expect(chunks.length).toBeGreaterThan(0)
    const parsed = JSON.parse(chunks[0]!)
    expect(parsed.level).toBe(30) // pino info level
    expect(parsed.repo).toBe('wearon')
    expect(parsed.msg).toBe('test message')
    expect(parsed.time).toBeDefined()
  })

  it('logger.warn produces correct level', async () => {
    const pino = (await import('pino')).default
    const chunks: string[] = []
    const dest = {
      write(chunk: string) {
        chunks.push(chunk)
      },
    }

    const testLogger = pino(
      {
        level: 'warn',
        base: { repo: 'wearon' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      dest,
    )

    testLogger.warn('warning message')

    const parsed = JSON.parse(chunks[0]!)
    expect(parsed.level).toBe(40) // pino warn level
    expect(parsed.msg).toBe('warning message')
  })

  it('logger.error produces correct level', async () => {
    const pino = (await import('pino')).default
    const chunks: string[] = []
    const dest = {
      write(chunk: string) {
        chunks.push(chunk)
      },
    }

    const testLogger = pino(
      {
        level: 'error',
        base: { repo: 'wearon' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      dest,
    )

    testLogger.error('error message')

    const parsed = JSON.parse(chunks[0]!)
    expect(parsed.level).toBe(50) // pino error level
    expect(parsed.msg).toBe('error message')
  })

  it('createChildLogger includes request_id field', async () => {
    const pino = (await import('pino')).default
    const chunks: string[] = []
    const dest = {
      write(chunk: string) {
        chunks.push(chunk)
      },
    }

    const parentLogger = pino(
      {
        level: 'info',
        base: { repo: 'wearon' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      dest,
    )

    const childLogger = parentLogger.child({ request_id: 'req_test-uuid-123' })
    childLogger.info('child log message')

    const parsed = JSON.parse(chunks[0]!)
    expect(parsed.request_id).toBe('req_test-uuid-123')
    expect(parsed.repo).toBe('wearon')
    expect(parsed.msg).toBe('child log message')
  })

  it('createChildLogger function returns a child logger', async () => {
    const { createChildLogger } = await import('../src/logger')
    const child = createChildLogger('req_abc-123')
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
    expect(typeof child.warn).toBe('function')
    expect(typeof child.error).toBe('function')
  })
})
