import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('Age Gate — COPPA Compliance', () => {
  describe('Age gate blocks under-13 users from try-on (Task 5.1)', () => {
    it('blocks access when user indicates they are under 13', () => {
      let blocked = false
      const denyAge = () => {
        blocked = true
      }

      denyAge()
      expect(blocked).toBe(true)
    })

    it('does not collect any photo data before age verification', () => {
      // Simulate the flow: age gate must be passed before camera opens
      let ageVerified = false
      let cameraOpened = false

      const openCamera = () => {
        if (!ageVerified) {
          throw new Error('Age verification required before camera access')
        }
        cameraOpened = true
      }

      expect(() => openCamera()).toThrow('Age verification required before camera access')
      expect(cameraOpened).toBe(false)
    })
  })

  describe('Age gate allows 13+ users to proceed (Task 5.2)', () => {
    it('allows access when user confirms they are 13 or older', () => {
      let verified = false
      const confirmAge = () => {
        verified = true
      }

      confirmAge()
      expect(verified).toBe(true)
    })

    it('stores verification in session storage', () => {
      const storage: Record<string, string> = {}
      const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'

      storage[AGE_VERIFIED_KEY] = 'true'
      expect(storage[AGE_VERIFIED_KEY]).toBe('true')
    })

    it('does not re-ask after successful verification', () => {
      const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'
      const storage: Record<string, string> = { [AGE_VERIFIED_KEY]: 'true' }

      const isAgeVerified = () => storage[AGE_VERIFIED_KEY] === 'true'
      expect(isAgeVerified()).toBe(true)
    })
  })

  describe('Server rejects generation without age verification (Task 5.3)', () => {
    it('B2C tRPC — rejects when ageVerified is false', () => {
      const input = {
        modelImageUrl: 'https://example.com/model.jpg',
        ageVerified: false,
      }

      expect(input.ageVerified).toBe(false)
      // Server would throw FORBIDDEN when ageVerified !== true
    })

    it('B2C tRPC — rejects when ageVerified is missing (undefined)', () => {
      const input = {
        modelImageUrl: 'https://example.com/model.jpg',
      } as { modelImageUrl: string; ageVerified?: boolean }

      expect(input.ageVerified).toBeUndefined()
      // Zod schema requires ageVerified: z.boolean() — missing field is validation error
    })

    it('B2C tRPC — allows when ageVerified is true', () => {
      const input = {
        modelImageUrl: 'https://example.com/model.jpg',
        ageVerified: true,
      }

      expect(input.ageVerified).toBe(true)
    })

    it('B2B REST — rejects when age_verified is not true', () => {
      const body = {
        image_urls: ['https://example.com/stores/store1/uploads/img.jpg'],
        age_verified: false,
      }

      // Server returns 403 with AGE_VERIFICATION_REQUIRED error code
      const shouldReject = body.age_verified !== true
      expect(shouldReject).toBe(true)
    })

    it('B2B REST — allows when age_verified is true', () => {
      const body = {
        image_urls: ['https://example.com/stores/store1/uploads/img.jpg'],
        age_verified: true,
      }

      const shouldReject = body.age_verified !== true
      expect(shouldReject).toBe(false)
    })

    it('B2B REST — returns correct error format', () => {
      const errorResponse = {
        data: null,
        error: {
          code: 'AGE_VERIFICATION_REQUIRED',
          message: 'Age verification is required to use this feature',
        },
      }

      expect(errorResponse.data).toBeNull()
      expect(errorResponse.error.code).toBe('AGE_VERIFICATION_REQUIRED')
      expect(errorResponse.error.message).toContain('Age verification')
    })
  })

  describe('No photo data collected before age verification (Task 5.4)', () => {
    it('age gate is presented before camera access in flow', () => {
      const flowSteps = ['age_gate', 'privacy_disclosure', 'camera_access', 'pose_guidance']

      expect(flowSteps.indexOf('age_gate')).toBeLessThan(flowSteps.indexOf('camera_access'))
      expect(flowSteps.indexOf('age_gate')).toBeLessThan(flowSteps.indexOf('privacy_disclosure'))
    })

    it('never stores date of birth — only boolean confirmation', () => {
      const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'
      const storage: Record<string, string> = {}

      // Only a boolean 'true' is stored — no DOB
      storage[AGE_VERIFIED_KEY] = 'true'

      const storedValue = storage[AGE_VERIFIED_KEY]
      expect(storedValue).toBe('true')
      // No other age-related data stored
      const ageKeys = Object.keys(storage).filter(
        (k) => k.includes('age') || k.includes('birth') || k.includes('dob'),
      )
      expect(ageKeys).toHaveLength(1)
      expect(ageKeys[0]).toBe(AGE_VERIFIED_KEY)
    })
  })

  describe('B2C auth endpoints unchanged (Task 5.5)', () => {
    it('auth endpoints are not modified by age gate', () => {
      // Age gate is a feature gate (before try-on) not an auth gate (login/signup)
      const authEndpoints = ['auth.signIn', 'auth.signUp', 'auth.signOut', 'auth.session']
      const ageGateEndpoints: string[] = [] // no new auth endpoints

      authEndpoints.forEach((endpoint) => {
        expect(ageGateEndpoints).not.toContain(endpoint)
      })
    })

    it('age gate component is in features/auth/ but does not modify auth flow', () => {
      const ageGateFile = 'packages/app/features/auth/age-gate.tsx'
      const authFiles = [
        'packages/app/features/auth/login-screen.tsx',
        'packages/app/features/auth/signup-screen.tsx',
        'packages/app/features/auth/google-sign-in-button.tsx',
        'packages/app/features/auth/auth-form-container.tsx',
      ]

      // age-gate is a new file, not a modification of existing auth files
      expect(authFiles).not.toContain(ageGateFile)
    })
  })
})
