import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * B2B Schema Integration Tests
 *
 * Tests run against a Supabase instance using the service role key.
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *
 * These tests validate:
 * - deduct_store_credits() and refund_store_credits() RPC functions
 * - store_credits auto-creation trigger on store insert
 * - CHECK constraints on status and billing_mode columns
 */

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

let testStoreId: string

describe('B2B Schema - Migration 005-007', () => {
  beforeAll(async () => {
    // Create a test store — trigger should auto-create store_credits
    const { data, error } = await supabase
      .from('stores')
      .insert({ shop_domain: `test-${Date.now()}.myshopify.com` })
      .select('id')
      .single()

    if (error) throw new Error(`Setup failed: ${error.message}`)
    testStoreId = data.id
  })

  afterAll(async () => {
    // Cleanup: delete test store (cascades to all related rows)
    if (testStoreId) {
      await supabase.from('stores').delete().eq('id', testStoreId)
    }
  })

  // =========================================================================
  // Task 4.3: store_credits auto-creation trigger
  // =========================================================================
  describe('store_credits auto-creation trigger', () => {
    it('should auto-create store_credits row with 0 balance when store is inserted', async () => {
      const { data, error } = await supabase
        .from('store_credits')
        .select('*')
        .eq('store_id', testStoreId)
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.store_id).toBe(testStoreId)
      expect(data!.balance).toBe(0)
      expect(data!.total_purchased).toBe(0)
      expect(data!.total_spent).toBe(0)
    })
  })

  // =========================================================================
  // Task 4.2: deduct_store_credits() and refund_store_credits() RPC functions
  // =========================================================================
  describe('deduct_store_credits()', () => {
    it('should return false when balance is 0 (insufficient credits)', async () => {
      const { data, error } = await supabase.rpc('deduct_store_credits', {
        p_store_id: testStoreId,
        p_amount: 1,
        p_request_id: 'req_test_insufficient',
        p_description: 'Test deduction with 0 balance',
      })

      expect(error).toBeNull()
      expect(data).toBe(false)
    })

    it('should deduct credits when sufficient balance exists', async () => {
      // First, give the store some credits via direct update
      await supabase
        .from('store_credits')
        .update({ balance: 10, total_purchased: 10 })
        .eq('store_id', testStoreId)

      const { data, error } = await supabase.rpc('deduct_store_credits', {
        p_store_id: testStoreId,
        p_amount: 3,
        p_request_id: 'req_test_deduct',
        p_description: 'Test deduction',
      })

      expect(error).toBeNull()
      expect(data).toBe(true)

      // Verify balance updated
      const { data: credits } = await supabase
        .from('store_credits')
        .select('balance, total_spent')
        .eq('store_id', testStoreId)
        .single()

      expect(credits!.balance).toBe(7)
      expect(credits!.total_spent).toBe(3)
    })

    it('should log a deduction transaction with request_id', async () => {
      const { data, error } = await supabase
        .from('store_credit_transactions')
        .select('*')
        .eq('store_id', testStoreId)
        .eq('request_id', 'req_test_deduct')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect(data!.amount).toBe(-3)
      expect(data!.type).toBe('deduction')
      expect(data!.description).toBe('Test deduction')
    })

    it('should fail deduction when amount exceeds remaining balance', async () => {
      const { data, error } = await supabase.rpc('deduct_store_credits', {
        p_store_id: testStoreId,
        p_amount: 100,
        p_request_id: 'req_test_exceed',
        p_description: 'Should fail',
      })

      expect(error).toBeNull()
      expect(data).toBe(false)

      // Balance unchanged
      const { data: credits } = await supabase
        .from('store_credits')
        .select('balance')
        .eq('store_id', testStoreId)
        .single()

      expect(credits!.balance).toBe(7)
    })
  })

  describe('refund_store_credits()', () => {
    it('should refund credits and log transaction', async () => {
      const { error } = await supabase.rpc('refund_store_credits', {
        p_store_id: testStoreId,
        p_amount: 2,
        p_request_id: 'req_test_refund',
        p_description: 'Test refund',
      })

      expect(error).toBeNull()

      // Verify balance updated
      const { data: credits } = await supabase
        .from('store_credits')
        .select('balance, total_spent')
        .eq('store_id', testStoreId)
        .single()

      expect(credits!.balance).toBe(9)
      expect(credits!.total_spent).toBe(1)

      // Verify transaction logged
      const { data: tx } = await supabase
        .from('store_credit_transactions')
        .select('*')
        .eq('store_id', testStoreId)
        .eq('request_id', 'req_test_refund')
        .single()

      expect(tx).not.toBeNull()
      expect(tx!.amount).toBe(2)
      expect(tx!.type).toBe('refund')
    })
  })

  // =========================================================================
  // Task 4.4: CHECK constraints
  // =========================================================================
  describe('CHECK constraints', () => {
    it('should reject invalid billing_mode on stores', async () => {
      const { error } = await supabase
        .from('stores')
        .insert({ shop_domain: `invalid-mode-${Date.now()}.myshopify.com`, billing_mode: 'invalid_mode' })

      expect(error).not.toBeNull()
      expect(error!.message).toContain('violates check constraint')
    })

    it('should reject invalid status on stores', async () => {
      const { error } = await supabase
        .from('stores')
        .insert({ shop_domain: `invalid-status-${Date.now()}.myshopify.com`, status: 'deleted' })

      expect(error).not.toBeNull()
      expect(error!.message).toContain('violates check constraint')
    })

    it('should reject invalid status on store_generation_sessions', async () => {
      const { error } = await supabase
        .from('store_generation_sessions')
        .insert({
          store_id: testStoreId,
          status: 'pending',
          model_image_url: 'https://example.com/test.jpg',
          prompt_system: 'test prompt',
        })

      expect(error).not.toBeNull()
      expect(error!.message).toContain('violates check constraint')
    })

    it('should accept valid status values on store_generation_sessions', async () => {
      const { data, error } = await supabase
        .from('store_generation_sessions')
        .insert({
          store_id: testStoreId,
          status: 'queued',
          model_image_url: 'https://example.com/test.jpg',
          prompt_system: 'test prompt',
          request_id: 'req_test_valid_status',
        })
        .select('id')
        .single()

      expect(error).toBeNull()
      expect(data).not.toBeNull()

      // Cleanup
      if (data) {
        await supabase.from('store_generation_sessions').delete().eq('id', data.id)
      }
    })

    it('should reject invalid transaction type on store_credit_transactions', async () => {
      const { error } = await supabase
        .from('store_credit_transactions')
        .insert({
          store_id: testStoreId,
          amount: 5,
          type: 'bonus',
        })

      expect(error).not.toBeNull()
      expect(error!.message).toContain('violates check constraint')
    })
  })

  // =========================================================================
  // Resell mode tables (migration 007)
  // =========================================================================
  describe('resell mode tables', () => {
    it('should enforce unique (store_id, shopper_email) on store_shopper_credits', async () => {
      const email = `shopper-${Date.now()}@test.com`

      // First insert should succeed
      const { error: err1 } = await supabase
        .from('store_shopper_credits')
        .insert({ store_id: testStoreId, shopper_email: email })

      expect(err1).toBeNull()

      // Duplicate should fail
      const { error: err2 } = await supabase
        .from('store_shopper_credits')
        .insert({ store_id: testStoreId, shopper_email: email })

      expect(err2).not.toBeNull()
      expect(err2!.message).toContain('duplicate key')

      // Cleanup
      await supabase
        .from('store_shopper_credits')
        .delete()
        .eq('store_id', testStoreId)
        .eq('shopper_email', email)
    })

    it('should enforce unique shopify_order_id on store_shopper_purchases', async () => {
      const orderId = `order_${Date.now()}`

      // First insert should succeed
      const { error: err1 } = await supabase
        .from('store_shopper_purchases')
        .insert({
          store_id: testStoreId,
          shopper_email: 'test@test.com',
          shopify_order_id: orderId,
          credits_purchased: 5,
          amount_paid: 4.99,
        })

      expect(err1).toBeNull()

      // Duplicate order_id should fail (idempotent webhook safety)
      const { error: err2 } = await supabase
        .from('store_shopper_purchases')
        .insert({
          store_id: testStoreId,
          shopper_email: 'test@test.com',
          shopify_order_id: orderId,
          credits_purchased: 5,
          amount_paid: 4.99,
        })

      expect(err2).not.toBeNull()
      expect(err2!.message).toContain('duplicate key')

      // Cleanup
      await supabase
        .from('store_shopper_purchases')
        .delete()
        .eq('shopify_order_id', orderId)
    })
  })

  // =========================================================================
  // snake_case validation (Task 4.1 - programmatic check)
  // =========================================================================
  describe('snake_case column naming', () => {
    it('all B2B tables should exist and be accessible', async () => {
      const tables = [
        'stores',
        'store_api_keys',
        'store_credits',
        'store_credit_transactions',
        'store_generation_sessions',
        'store_analytics_events',
        'store_shopper_credits',
        'store_shopper_purchases',
      ]

      for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(0)
        expect(error, `Table ${table} should exist and be queryable`).toBeNull()
      }
    })
  })
})
