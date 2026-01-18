'use client'

import { YStack, H1, Text } from '@my/ui'

export function AdminAnalytics() {
  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$4"
    >
      <YStack gap="$2">
        <H1>Analytics</H1>
        <Text color="$color10">View platform analytics and usage statistics</Text>
      </YStack>

      <YStack
        flex={1}
        items="center"
        justify="center"
      >
        <Text color="$color10">Analytics dashboard coming soon...</Text>
      </YStack>
    </YStack>
  )
}
