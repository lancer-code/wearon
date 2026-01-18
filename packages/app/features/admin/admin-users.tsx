'use client'

import { YStack, H1, Text } from '@my/ui'

export function AdminUsers() {
  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$4"
    >
      <YStack gap="$2">
        <H1>Users</H1>
        <Text color="$color10">Manage users, assign roles, and view user details</Text>
      </YStack>

      <YStack
        flex={1}
        items="center"
        justify="center"
      >
        <Text color="$color10">User management coming soon...</Text>
      </YStack>
    </YStack>
  )
}
