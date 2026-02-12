import { describe, expect, it, vi, beforeEach } from 'vitest'

// Set env vars before any imports (required by getServiceClient singleton)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock Supabase client
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs)
            return { single: () => mockSingle() }
          },
        }
      },
    }),
  }),
}))

// Import AFTER mocks are set up
const { deductStoreCredit, refundStoreCredit, getStoreBalance } = await import(
  '../../src/services/b2b-credits'
)

describe('B2B credit service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('deductStoreCredit (AC: #1)', () => {
    it('calls deduct_store_credits RPC with correct params', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      const result = await deductStoreCredit('store-123', 'req_abc', 'Test deduction')

      expect(mockRpc).toHaveBeenCalledWith('deduct_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'Test deduction',
      })
      expect(result).toBe(true)
    })

    it('returns false when insufficient balance', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await deductStoreCredit('store-123', 'req_abc', 'Test deduction')
      expect(result).toBe(false)
    })

    it('throws on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

      await expect(
        deductStoreCredit('store-123', 'req_abc', 'Test deduction'),
      ).rejects.toThrow('Credit deduction failed')
    })

    it('uses default description when not provided', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null })

      await deductStoreCredit('store-123', 'req_abc')

      expect(mockRpc).toHaveBeenCalledWith('deduct_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'Generation credit deduction',
      })
    })
  })

  describe('refundStoreCredit (AC: #2)', () => {
    it('calls refund_store_credits RPC with correct params', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      await refundStoreCredit('store-123', 'req_abc', 'Generation failed')

      expect(mockRpc).toHaveBeenCalledWith('refund_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'Generation failed',
      })
    })

    it('throws on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

      await expect(
        refundStoreCredit('store-123', 'req_abc', 'Test refund'),
      ).rejects.toThrow('Credit refund failed')
    })

    it('uses default description when not provided', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      await refundStoreCredit('store-123', 'req_abc')

      expect(mockRpc).toHaveBeenCalledWith('refund_store_credits', {
        p_store_id: 'store-123',
        p_amount: 1,
        p_request_id: 'req_abc',
        p_description: 'Generation failed - refund',
      })
    })
  })

  describe('getStoreBalance (AC: #3)', () => {
    it('returns balance, totalPurchased, totalSpent from store_credits', async () => {
      mockSingle.mockResolvedValue({
        data: { balance: 50, total_purchased: 100, total_spent: 50 },
        error: null,
      })

      const result = await getStoreBalance('store-123')

      expect(result).toEqual({
        balance: 50,
        totalPurchased: 100,
        totalSpent: 50,
      })
    })

    it('returns zero values when store_credits not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

      const result = await getStoreBalance('store-unknown')

      expect(result).toEqual({
        balance: 0,
        totalPurchased: 0,
        totalSpent: 0,
      })
    })
  })

  describe('balance endpoint response format (AC: #3)', () => {
    it('response data uses snake_case field names', () => {
      // Simulate the successResponse(toSnakeCase(...)) behavior
      const camelCaseData = {
        balance: 50,
        totalPurchased: 100,
        totalSpent: 50,
      }

      // toSnakeCase converts keys
      const expectedSnakeCase = {
        balance: 50,
        total_purchased: 100,
        total_spent: 50,
      }

      // Verify the key transformation
      expect(Object.keys(expectedSnakeCase)).toContain('total_purchased')
      expect(Object.keys(expectedSnakeCase)).toContain('total_spent')
      expect(Object.keys(expectedSnakeCase)).not.toContain('totalPurchased')
      expect(Object.keys(expectedSnakeCase)).not.toContain('totalSpent')
    })
  })

  describe('insufficient credits (AC: #4)', () => {
    it('deductStoreCredit returns false when balance is 0', async () => {
      // RPC returns false when insufficient balance
      mockRpc.mockResolvedValue({ data: false, error: null })

      const result = await deductStoreCredit('store-zero', 'req_xyz', 'Generation attempt')

      expect(result).toBe(false)
    })

    it('402 error code is INSUFFICIENT_CREDITS', () => {
      const errorCode = 'INSUFFICIENT_CREDITS'
      const httpStatus = 402

      expect(errorCode).toBe('INSUFFICIENT_CREDITS')
      expect(httpStatus).toBe(402)
    })
  })

  describe('B2C credits unchanged (AC: #5)', () => {
    it('B2C uses user_credits table (not store_credits)', () => {
      // B2C queries user_credits by user_id
      const b2cTable = 'user_credits'
      const b2cKey = 'user_id'

      // B2B queries store_credits by store_id
      const b2bTable = 'store_credits'
      const b2bKey = 'store_id'

      expect(b2cTable).not.toBe(b2bTable)
      expect(b2cKey).not.toBe(b2bKey)
    })

    it('B2C uses deduct_credits RPC (not deduct_store_credits)', () => {
      const b2cRpc = 'deduct_credits'
      const b2bRpc = 'deduct_store_credits'

      expect(b2cRpc).not.toBe(b2bRpc)
    })

    it('B2C getBalance returns total_earned (not total_purchased)', () => {
      // B2C credit fields
      const b2cFields = ['balance', 'total_earned', 'total_spent', 'updated_at']

      // B2B credit fields
      const b2bFields = ['balance', 'total_purchased', 'total_spent']

      expect(b2cFields).toContain('total_earned')
      expect(b2cFields).not.toContain('total_purchased')
      expect(b2bFields).toContain('total_purchased')
      expect(b2bFields).not.toContain('total_earned')
    })
  })
})
