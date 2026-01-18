'use client'

import { YStack, Text, PageHeader, PageContent, PageFooter } from '@my/ui'

export function AdminUsers() {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <PageHeader
        title="Users"
        subtitle="Manage users, assign roles, and view user details"
      />

      <PageContent>
        <YStack flex={1} items="center" justify="center">
          <Text color="$color10">User management coming soon...</Text>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Total users: --
        </Text>
      </PageFooter>
    </YStack>
  )
}
