'use client'

import { YStack, Text, PageHeader, PageContent, PageFooter } from '@my/ui'

export function AdminAnalytics() {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageHeader
        title="Analytics"
        subtitle="View platform analytics and usage statistics"
      />

      <PageContent>
        <YStack flex={1} items="center" justify="center">
          <Text color="$color10">Analytics dashboard coming soon...</Text>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Data updated: --
        </Text>
      </PageFooter>
    </YStack>
  )
}
