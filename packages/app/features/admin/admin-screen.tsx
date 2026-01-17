'use client'

import { YStack, XStack, H1, H2, Text, Card, Separator } from '@my/ui'
import { useSupabase } from '../../provider/SupabaseProvider'

export function AdminScreen() {
  const { user, roles, isAdmin, isModerator } = useSupabase()

  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$6"
      maxWidth={1200}
      marginHorizontal="auto"
      width="100%"
    >
      <YStack gap="$2">
        <H1>Admin Panel</H1>
        <Text color="$gray11">Welcome, {user?.email}</Text>
      </YStack>

      <XStack
        gap="$4"
        flexWrap="wrap"
      >
        <Card
          padding="$4"
          flex={1}
          minWidth={200}
        >
          <YStack gap="$2">
            <Text
              color="$gray11"
              fontSize="$3"
            >
              Your Role
            </Text>
            <Text
              fontSize="$6"
              fontWeight="bold"
            >
              {isAdmin ? 'Admin' : isModerator ? 'Moderator' : 'User'}
            </Text>
          </YStack>
        </Card>

        <Card
          padding="$4"
          flex={1}
          minWidth={200}
        >
          <YStack gap="$2">
            <Text
              color="$gray11"
              fontSize="$3"
            >
              All Roles
            </Text>
            <Text
              fontSize="$6"
              fontWeight="bold"
            >
              {roles.join(', ') || 'None'}
            </Text>
          </YStack>
        </Card>
      </XStack>

      <Separator />

      <YStack gap="$4">
        <H2>Quick Actions</H2>
        <XStack
          gap="$4"
          flexWrap="wrap"
        >
          {isAdmin && (
            <Card
              padding="$4"
              flex={1}
              minWidth={250}
              hoverStyle={{ backgroundColor: '$gray3' }}
            >
              <YStack gap="$2">
                <Text fontWeight="bold">User Management</Text>
                <Text
                  color="$gray11"
                  fontSize="$2"
                >
                  Manage users, assign roles, and view user details
                </Text>
              </YStack>
            </Card>
          )}

          <Card
            padding="$4"
            flex={1}
            minWidth={250}
            hoverStyle={{ backgroundColor: '$gray3' }}
          >
            <YStack gap="$2">
              <Text fontWeight="bold">Analytics</Text>
              <Text
                color="$gray11"
                fontSize="$2"
              >
                View platform analytics and usage statistics
              </Text>
            </YStack>
          </Card>

          <Card
            padding="$4"
            flex={1}
            minWidth={250}
            hoverStyle={{ backgroundColor: '$gray3' }}
          >
            <YStack gap="$2">
              <Text fontWeight="bold">Generations</Text>
              <Text
                color="$gray11"
                fontSize="$2"
              >
                Monitor and manage generation sessions
              </Text>
            </YStack>
          </Card>

          {isAdmin && (
            <Card
              padding="$4"
              flex={1}
              minWidth={250}
              hoverStyle={{ backgroundColor: '$gray3' }}
            >
              <YStack gap="$2">
                <Text fontWeight="bold">Credits Management</Text>
                <Text
                  color="$gray11"
                  fontSize="$2"
                >
                  Grant credits and manage user balances
                </Text>
              </YStack>
            </Card>
          )}
        </XStack>
      </YStack>
    </YStack>
  )
}
