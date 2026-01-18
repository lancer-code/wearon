'use client'

import { YStack, XStack, H2, Text, Card, Separator, PageHeader, PageContent, PageFooter } from '@my/ui'
import { useSupabase } from '../../provider/SupabaseProvider'

export function AdminDashboard() {
  const { user, roles, isAdmin, isModerator } = useSupabase()

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.email}`}
      />

      <PageContent>
        <XStack gap="$4" flexWrap="wrap">
          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                Your Role
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {isAdmin ? 'Admin' : isModerator ? 'Moderator' : 'User'}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                All Roles
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {roles.join(', ') || 'None'}
              </Text>
            </YStack>
          </Card>
        </XStack>

        <Separator />

        <YStack gap="$4">
          <H2>Overview</H2>
          <XStack gap="$4" flexWrap="wrap">
            <Card padding="$4" flex={1} minWidth={200}>
              <YStack gap="$2">
                <Text color="$color10" fontSize="$3">
                  Total Users
                </Text>
                <Text fontSize="$8" fontWeight="bold">
                  --
                </Text>
              </YStack>
            </Card>

            <Card padding="$4" flex={1} minWidth={200}>
              <YStack gap="$2">
                <Text color="$color10" fontSize="$3">
                  Total Generations
                </Text>
                <Text fontSize="$8" fontWeight="bold">
                  --
                </Text>
              </YStack>
            </Card>

            <Card padding="$4" flex={1} minWidth={200}>
              <YStack gap="$2">
                <Text color="$color10" fontSize="$3">
                  Credits Issued
                </Text>
                <Text fontSize="$8" fontWeight="bold">
                  --
                </Text>
              </YStack>
            </Card>

            <Card padding="$4" flex={1} minWidth={200}>
              <YStack gap="$2">
                <Text color="$color10" fontSize="$3">
                  Active Today
                </Text>
                <Text fontSize="$8" fontWeight="bold">
                  --
                </Text>
              </YStack>
            </Card>
          </XStack>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Last updated: just now
        </Text>
      </PageFooter>
    </YStack>
  )
}
