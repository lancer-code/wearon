'use client'

import { YStack, H1, Text } from '@my/ui'

export function AdminGenerations() {
  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$4"
    >
      <YStack gap="$2">
        <H1>Generations</H1>
        <Text color="$color10">Monitor and manage generation sessions</Text>
      </YStack>

      <YStack
        flex={1}
        items="center"
        justify="center"
      >
        <Text color="$color10">Generations management coming soon...</Text>
      </YStack>
    </YStack>
  )
}
