'use client'

import { YStack, Text, PageHeader, PageContent, PageFooter } from '@my/ui'

export function AdminCredits() {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageHeader
        title="Credits"
        subtitle="Grant credits and manage user balances"
      />

      <PageContent>
        <YStack flex={1} items="center" justify="center">
          <Text color="$color10">Credits management coming soon...</Text>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Total credits issued: --
        </Text>
      </PageFooter>
    </YStack>
  )
}
