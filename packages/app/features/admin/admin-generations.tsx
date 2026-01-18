'use client'

import { YStack, Text, PageHeader, PageContent, PageFooter } from '@my/ui'

export function AdminGenerations() {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageHeader
        title="Generations"
        subtitle="Monitor and manage generation sessions"
      />

      <PageContent>
        <YStack flex={1} items="center" justify="center">
          <Text color="$color10">Generations management coming soon...</Text>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Total generations: --
        </Text>
      </PageFooter>
    </YStack>
  )
}
