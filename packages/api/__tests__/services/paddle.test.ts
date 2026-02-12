import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  calculatePaygTotalCents,
  getTierCredits,
  getTierOverageCents,
  parsePaddleWebhookEvent,
  verifyPaddleWebhookSignature,
} from '../../src/services/paddle'

describe('paddle service helpers', () => {
  it('calculates PAYG totals correctly', () => {
    expect(calculatePaygTotalCents(1)).toBe(18)
    expect(calculatePaygTotalCents(100)).toBe(1800)
  })

  it('returns tier config values', () => {
    expect(getTierCredits('starter')).toBe(350)
    expect(getTierCredits('growth')).toBe(800)
    expect(getTierCredits('scale')).toBe(1800)

    expect(getTierOverageCents('starter')).toBe(16)
    expect(getTierOverageCents('growth')).toBe(14)
    expect(getTierOverageCents('scale')).toBe(12)
  })

  it('verifies paddle webhook signature with ts/h1 format', () => {
    const secret = 'test_webhook_secret'
    const timestamp = '1700000000'
    const body = JSON.stringify({ event_id: 'evt_123', event_type: 'transaction.completed' })
    const digest = crypto.createHmac('sha256', secret).update(`${timestamp}:${body}`).digest('hex')
    const signatureHeader = `ts=${timestamp};h1=${digest}`

    expect(verifyPaddleWebhookSignature(body, signatureHeader, secret)).toBe(true)
    expect(verifyPaddleWebhookSignature(body, `ts=${timestamp};h1=deadbeef`, secret)).toBe(false)
    expect(verifyPaddleWebhookSignature(body, null, secret)).toBe(false)
  })

  it('parses webhook event payload', () => {
    const body = JSON.stringify({
      event_id: 'evt_abc',
      event_type: 'subscription.updated',
      data: { id: 'sub_123' },
    })

    const event = parsePaddleWebhookEvent(body)
    expect(event.event_id).toBe('evt_abc')
    expect(event.event_type).toBe('subscription.updated')
    expect(event.data?.id).toBe('sub_123')
  })
})
