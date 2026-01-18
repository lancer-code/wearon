'use client'

import { YStack, H1, Text } from '@my/ui'

export function AdminSettings() {
  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$4"
    >
      <YStack gap="$2">
        <H1>Settings</H1>
        <Text color="$color10">Configure admin panel settings</Text>
      </YStack>

      <YStack
        flex={1}
        items="center"
        justify="center"
      >
        <Text color="$color10">Settings coming soon...</Text>
      </YStack>
    </YStack>
  )
}
