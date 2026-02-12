import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('encryption utility', () => {
  const testKey = crypto.randomBytes(32).toString('hex')

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = testKey
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it('encrypt and decrypt roundtrip returns original plaintext', async () => {
    const { encrypt, decrypt } = await import('../../src/utils/encryption')

    const plaintext = 'shpat_test_access_token_12345'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('different inputs produce different ciphertext', async () => {
    const { encrypt } = await import('../../src/utils/encryption')

    const encrypted1 = encrypt('token_aaa')
    const encrypted2 = encrypt('token_bbb')

    expect(encrypted1).not.toBe(encrypted2)
  })

  it('same input produces different ciphertext (random IV)', async () => {
    const { encrypt } = await import('../../src/utils/encryption')

    const encrypted1 = encrypt('same_token')
    const encrypted2 = encrypt('same_token')

    expect(encrypted1).not.toBe(encrypted2)
  })

  it('ciphertext format is iv:encrypted', async () => {
    const { encrypt } = await import('../../src/utils/encryption')

    const encrypted = encrypt('test')
    const parts = encrypted.split(':')

    expect(parts).toHaveLength(2)
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/)
    // Encrypted portion is hex
    expect(parts[1]).toMatch(/^[0-9a-f]+$/)
  })

  it('throws when ENCRYPTION_KEY is missing', async () => {
    delete process.env.ENCRYPTION_KEY
    // Need fresh module since key is read at call time
    const { encrypt } = await import('../../src/utils/encryption')

    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set')
  })

  it('decrypt throws on invalid ciphertext format', async () => {
    const { decrypt } = await import('../../src/utils/encryption')

    expect(() => decrypt('invalid-no-colon')).toThrow('Invalid ciphertext format')
    expect(() => decrypt('')).toThrow('Invalid ciphertext format')
  })
})
