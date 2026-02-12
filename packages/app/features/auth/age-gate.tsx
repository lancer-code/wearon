'use client'

import { useState, useCallback, useEffect } from 'react'
import { YStack, Text, Button, Card } from '@my/ui'

const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'

// MEDIUM #2 FIX: Add timestamp validation to prevent stale/tampered verification
const AGE_VERIFIED_TIMESTAMP_KEY = 'wearon_age_verified_ts_v1'
const MAX_AGE_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

function getSessionStorage(): Storage | null {
  if (typeof globalThis === 'undefined' || !globalThis.sessionStorage) {
    return null
  }
  return globalThis.sessionStorage
}

/** Check if the user has already verified their age this session */
export function isAgeVerified(): boolean {
  const storage = getSessionStorage()
  if (!storage) {
    return false
  }

  const verified = storage.getItem(AGE_VERIFIED_KEY) === 'true'
  if (!verified) {
    return false
  }

  // MEDIUM #2 FIX: Validate timestamp hasn't been tampered or expired
  const timestampStr = storage.getItem(AGE_VERIFIED_TIMESTAMP_KEY)
  if (!timestampStr) {
    // No timestamp - invalidate verification
    storage.removeItem(AGE_VERIFIED_KEY)
    return false
  }

  const timestamp = Number(timestampStr)
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    // Invalid timestamp - clear and reject
    storage.removeItem(AGE_VERIFIED_KEY)
    storage.removeItem(AGE_VERIFIED_TIMESTAMP_KEY)
    return false
  }

  const now = Date.now()
  const age = now - timestamp

  if (age < 0 || age > MAX_AGE_VERIFICATION_DURATION_MS) {
    // Timestamp is in the future (tampered) or too old - invalidate
    storage.removeItem(AGE_VERIFIED_KEY)
    storage.removeItem(AGE_VERIFIED_TIMESTAMP_KEY)
    return false
  }

  return true
}

/** Store age verification result in session storage */
export function setAgeVerified(): void {
  const storage = getSessionStorage()
  if (storage) {
    storage.setItem(AGE_VERIFIED_KEY, 'true')
    storage.setItem(AGE_VERIFIED_TIMESTAMP_KEY, Date.now().toString())
  }
}

/**
 * Hook that provides age verification state and actions.
 * Checks session storage on mount so the gate is only shown once per session.
 */
export function useAgeGate() {
  // LOW #3 FIX: Remove redundant useEffect to prevent race condition and component flicker
  // Only read session storage once during initialization
  const [verified, setVerified] = useState(() => isAgeVerified())
  const [blocked, setBlocked] = useState(false)

  const confirmAge = useCallback(() => {
    setAgeVerified()
    setVerified(true)
    setBlocked(false)
  }, [])

  const denyAge = useCallback(() => {
    setBlocked(true)
  }, [])

  return {
    /** Whether the user has confirmed they are 13+ this session */
    verified,
    /** Whether the user indicated they are under 13 */
    blocked,
    /** Call when user confirms they are 13 or older */
    confirmAge,
    /** Call when user indicates they are under 13 */
    denyAge,
  }
}

/**
 * Age gate UI component. Shown before try-on and size rec features.
 * Presents a simple "Are you 13 or older?" confirmation.
 * Users who indicate they are under 13 are blocked from accessing features.
 *
 * Props:
 * - onVerified: called when user confirms they are 13+
 * - children: the content to render once verified (try-on / size rec UI)
 */
export function AgeGate({
  onVerified,
  children,
}: {
  onVerified?: () => void
  children: React.ReactNode
}) {
  const { verified, blocked, confirmAge, denyAge } = useAgeGate()

  const handleConfirm = useCallback(() => {
    confirmAge()
    onVerified?.()
  }, [confirmAge, onVerified])

  // Already verified this session — render children directly
  if (verified) {
    return <>{children}</>
  }

  // User indicated they are under 13 — block access
  if (blocked) {
    return (
      <Card padding="$6" marginVertical="$4">
        <YStack gap="$3" alignItems="center">
          <Text fontSize="$6" fontWeight="600" textAlign="center">
            Feature Not Available
          </Text>
          <Text color="$color10" textAlign="center">
            This feature is not available for users under 13.
          </Text>
        </YStack>
      </Card>
    )
  }

  // Show age gate prompt
  return (
    <Card padding="$6" marginVertical="$4">
      <YStack gap="$4" alignItems="center">
        <Text fontSize="$6" fontWeight="600" textAlign="center">
          Age Verification
        </Text>
        <Text color="$color10" textAlign="center">
          You must be 13 or older to use try-on and size recommendation features.
        </Text>
        <YStack gap="$2" width="100%" maxWidth={300}>
          <Button onPress={handleConfirm} theme="active">
            I am 13 or older
          </Button>
          <Button onPress={denyAge} variant="outlined">
            I am under 13
          </Button>
        </YStack>
      </YStack>
    </Card>
  )
}
