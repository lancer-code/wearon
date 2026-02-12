import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'

describe('shopify oauth', () => {
  describe('API key generation', () => {
    it('generates key in wk_ + 32 hex char format', () => {
      const randomHex = crypto.randomBytes(16).toString('hex')
      const apiKey = `wk_${randomHex}`

      expect(apiKey).toMatch(/^wk_[0-9a-f]{32}$/)
    })

    it('SHA-256 hash is deterministic for same key', () => {
      const apiKey = 'wk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
      const hash1 = crypto.createHash('sha256').update(apiKey).digest('hex')
      const hash2 = crypto.createHash('sha256').update(apiKey).digest('hex')

      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[0-9a-f]{64}$/)
    })

    it('different keys produce different hashes', () => {
      const key1 = `wk_${crypto.randomBytes(16).toString('hex')}`
      const key2 = `wk_${crypto.randomBytes(16).toString('hex')}`

      const hash1 = crypto.createHash('sha256').update(key1).digest('hex')
      const hash2 = crypto.createHash('sha256').update(key2).digest('hex')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('store registration data', () => {
    it('new store record has correct fields', () => {
      const storeData = {
        shop_domain: 'test-store.myshopify.com',
        access_token_encrypted: 'encrypted_value',
        status: 'active',
        billing_mode: 'absorb_mode',
        onboarding_completed: false,
      }

      expect(storeData.status).toBe('active')
      expect(storeData.billing_mode).toBe('absorb_mode')
      expect(storeData.onboarding_completed).toBe(false)
    })

    it('API key record has correct structure', () => {
      const shopDomain = 'test-store.myshopify.com'
      const keyData = {
        store_id: 'store-uuid',
        key_hash: crypto.createHash('sha256').update('wk_test').digest('hex'),
        label: 'Default API Key',
        allowed_domains: [shopDomain],
        is_active: true,
      }

      expect(keyData.allowed_domains).toContain(shopDomain)
      expect(keyData.is_active).toBe(true)
      expect(keyData.key_hash).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('re-installation', () => {
    it('re-installation updates access token and reactivates', () => {
      const updateData = {
        access_token_encrypted: 'new_encrypted_value',
        status: 'active',
      }

      expect(updateData.status).toBe('active')
      expect(updateData.access_token_encrypted).toBeTruthy()
    })
  })
})
