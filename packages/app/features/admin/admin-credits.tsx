'use client'

import { YStack, H1, Text } from '@my/ui'

export function AdminCredits() {
  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$4"
    >
      <YStack gap="$2">
        <H1>Credits</H1>
        <Text color="$color10">Grant credits and manage user balances</Text>
      </YStack>

      <YStack
        flex={1}
        items="center"
        justify="center"
      >
        <Text color="$color10">Credits management coming soon...</Text>
      </YStack>
    </YStack>
  )
}
