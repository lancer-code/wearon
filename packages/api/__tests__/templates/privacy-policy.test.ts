import { describe, expect, it } from 'vitest'
import {
  getGdprTemplate,
  getCcpaTemplate,
  getDpaTemplate,
  PLUGIN_PRIVACY_DISCLOSURE,
} from '../../src/templates/privacy-policy'

describe('Privacy Policy Templates (Story 8.1)', () => {
  describe('GDPR template (Task 1.1)', () => {
    it('contains store name placeholder when no name provided', () => {
      const template = getGdprTemplate()
      expect(template).toContain('{{STORE_NAME}}')
    })

    it('auto-fills store name when provided', () => {
      const template = getGdprTemplate('My Test Store')
      expect(template).toContain('My Test Store')
      expect(template).not.toContain('{{STORE_NAME}}')
    })

    it('covers photo processing', () => {
      const template = getGdprTemplate()
      expect(template).toContain('Photographs')
      expect(template).toContain('virtual try-on')
    })

    it('covers 6-hour deletion', () => {
      const template = getGdprTemplate()
      expect(template).toContain('6 hours')
      expect(template).toContain('automatically deleted')
    })

    it('covers third-party OpenAI data handling', () => {
      const template = getGdprTemplate()
      expect(template).toContain('OpenAI')
      expect(template).toContain('sub-processor')
    })

    it('covers data subject rights', () => {
      const template = getGdprTemplate()
      expect(template).toContain('Access')
      expect(template).toContain('Erasure')
      expect(template).toContain('Portability')
      expect(template).toContain('Withdraw Consent')
    })
  })

  describe('CCPA template (Task 1.2)', () => {
    it('contains store name placeholder when no name provided', () => {
      const template = getCcpaTemplate()
      expect(template).toContain('{{STORE_NAME}}')
    })

    it('auto-fills store name when provided', () => {
      const template = getCcpaTemplate('California Store')
      expect(template).toContain('California Store')
      expect(template).not.toContain('{{STORE_NAME}}')
    })

    it('covers biometric data category', () => {
      const template = getCcpaTemplate()
      expect(template).toContain('Biometric Information')
      expect(template).toContain('Photographs')
    })

    it('covers no-sale disclosure', () => {
      const template = getCcpaTemplate()
      expect(template).toContain('do NOT sell')
    })

    it('covers right to delete', () => {
      const template = getCcpaTemplate()
      expect(template).toContain('Right to Delete')
    })

    it('covers right to opt-out', () => {
      const template = getCcpaTemplate()
      expect(template).toContain('Right to Opt-Out')
    })
  })

  describe('DPA template (Task 1.3)', () => {
    it('contains store name placeholder when no name provided', () => {
      const template = getDpaTemplate()
      expect(template).toContain('{{STORE_NAME}}')
    })

    it('auto-fills store name when provided', () => {
      const template = getDpaTemplate('Partner Store')
      expect(template).toContain('Partner Store')
      expect(template).not.toContain('{{STORE_NAME}}')
    })

    it('describes 3-party data flow', () => {
      const template = getDpaTemplate()
      expect(template).toContain('Controller')
      expect(template).toContain('Processor')
      expect(template).toContain('Sub-Processor')
      expect(template).toContain('OpenAI')
    })

    it('covers security measures', () => {
      const template = getDpaTemplate()
      expect(template).toContain('TLS')
      expect(template).toContain('AES-256')
      expect(template).toContain('API key authentication')
    })

    it('covers breach notification', () => {
      const template = getDpaTemplate()
      expect(template).toContain('72 hours')
      expect(template).toContain('breach')
    })

    it('covers 6-hour deletion', () => {
      const template = getDpaTemplate()
      expect(template).toContain('6 hours')
    })
  })

  describe('Plugin privacy disclosure (Task 3.3)', () => {
    it('contains the required disclosure text', () => {
      expect(PLUGIN_PRIVACY_DISCLOSURE).toContain('deleted within 6 hours')
      expect(PLUGIN_PRIVACY_DISCLOSURE).toContain('WearOn')
      expect(PLUGIN_PRIVACY_DISCLOSURE).toContain('OpenAI')
    })
  })
})
