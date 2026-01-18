'use client'

import { YStack, Text, PageHeader, PageContent, PageFooter } from '@my/ui'

export function AdminSettings() {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageHeader
        title="Settings"
        subtitle="Configure admin panel settings"
      />

      <PageContent>
        <YStack flex={1} items="center" justify="center">
          <Text color="$color10">Settings coming soon...</Text>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Version: 1.0.0
        </Text>
      </PageFooter>
    </YStack>
  )
}
