'use client'

import { useState, useCallback, useEffect } from 'react'
import { YStack, Text, Button, Card } from '@my/ui'

const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'

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
  return storage.getItem(AGE_VERIFIED_KEY) === 'true'
}

/** Store age verification result in session storage */
export function setAgeVerified(): void {
  const storage = getSessionStorage()
  if (storage) {
    storage.setItem(AGE_VERIFIED_KEY, 'true')
  }
}

/**
 * Hook that provides age verification state and actions.
 * Checks session storage on mount so the gate is only shown once per session.
 */
export function useAgeGate() {
  const [verified, setVerified] = useState(() => isAgeVerified())
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    setVerified(isAgeVerified())
  }, [])

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
