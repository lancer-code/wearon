'use client'

import { YStack, XStack, Text, Card, PageHeader, PageContent, PageFooter } from '@my/ui'
import { Users, Activity, CreditCard, UserPlus } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  isLoading: boolean
}) {
  return (
    <Card padding="$4" flex={1} minWidth={200}>
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <Icon size={16} color="$color10" />
          <Text color="$color10" fontSize="$3">
            {title}
          </Text>
        </XStack>
        <Text fontSize="$8" fontWeight="bold">
          {isLoading ? '...' : value}
        </Text>
      </YStack>
    </Card>
  )
}

export function AdminB2CAnalytics() {
  const { data: overview, isLoading } =
    trpc.analytics.getB2COverview.useQuery({})

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <PageHeader
        title="B2C Analytics"
        subtitle="Monitor consumer app usage and growth"
      />

      <PageContent>
        {/* User Growth */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            User Growth
          </Text>
          <XStack gap="$4" flexWrap="wrap">
            <StatCard
              title="Total Users"
              value={overview?.totalUsers ?? 0}
              icon={Users}
              isLoading={isLoading}
            />
            <StatCard
              title="New (7d)"
              value={overview?.newUsers7d ?? 0}
              icon={UserPlus}
              isLoading={isLoading}
            />
            <StatCard
              title="New (30d)"
              value={overview?.newUsers30d ?? 0}
              icon={UserPlus}
              isLoading={isLoading}
            />
            <StatCard
              title="Active (30d)"
              value={overview?.activeUsers30d ?? 0}
              icon={Users}
              isLoading={isLoading}
            />
          </XStack>
        </YStack>

        {/* Generation & Credit Stats */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            Generation & Credit Stats
          </Text>
          <XStack gap="$4" flexWrap="wrap">
            <StatCard
              title="Total Generations"
              value={overview?.totalGenerations ?? 0}
              icon={Activity}
              isLoading={isLoading}
            />
            <StatCard
              title="Credits Consumed"
              value={overview?.totalCreditsConsumed ?? 0}
              icon={CreditCard}
              isLoading={isLoading}
            />
            <StatCard
              title="Signup Bonuses"
              value={overview?.creditPurchases ?? 0}
              icon={CreditCard}
              isLoading={isLoading}
            />
          </XStack>
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Data updated: just now
        </Text>
      </PageFooter>
    </YStack>
  )
}
