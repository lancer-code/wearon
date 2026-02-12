'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'solito/navigation'
import {
  Button,
  Card,
  H2,
  H3,
  PageContent,
  PageHeader,
  Separator,
  Text,
  XStack,
  YStack,
} from '@my/ui'
import { trpc } from '../../utils/trpc'

type SubscriptionTier = 'starter' | 'growth' | 'scale'

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const tierRank: Record<SubscriptionTier, number> = {
  starter: 1,
  growth: 2,
  scale: 3,
}

export function MerchantBilling() {
  const searchParams = useSearchParams()
  const [paygCredits, setPaygCredits] = useState(100)

  const storeQuery = trpc.merchant.getMyStore.useQuery()
  const catalogQuery = trpc.merchant.getBillingCatalog.useQuery()
  const creditBalanceQuery = trpc.merchant.getCreditBalance.useQuery()
  const overageUsageQuery = trpc.merchant.getOverageUsage.useQuery()

  const createCheckout = trpc.merchant.createCheckoutSession.useMutation()
  const changePlan = trpc.merchant.changePlan.useMutation({
    onSuccess: () => {
      storeQuery.refetch()
      catalogQuery.refetch()
    },
  })

  const status = searchParams?.get('status')
  const store = storeQuery.data
  const catalog = catalogQuery.data?.catalog

  const paygTotal = useMemo(() => {
    if (!catalog) {
      return 0
    }
    return paygCredits * catalog.payg.pricePerCreditCents
  }, [catalog, paygCredits])

  const overageUsage = overageUsageQuery.data ?? []

  const handleStartSubscription = async (tier: SubscriptionTier) => {
    const result = await createCheckout.mutateAsync({ mode: 'subscription', tier })
    window.location.href = result.checkoutUrl
  }

  const handleChangePlan = async (tier: SubscriptionTier) => {
    await changePlan.mutateAsync({ targetTier: tier })
  }

  const handlePaygCheckout = async () => {
    const result = await createCheckout.mutateAsync({
      mode: 'payg',
      credits: paygCredits,
    })
    window.location.href = result.checkoutUrl
  }

  return (
    <YStack
      flex={1}
      padding="$6"
      gap="$6"
      style={{ overflowY: 'auto' }}
    >
      <PageHeader
        title="Billing"
        subtitle="Manage subscriptions, PAYG credit purchases, and overage behavior."
      />

      <PageContent>
        {status === 'success' && (
          <Card
            padding="$4"
            backgroundColor="$green3"
            borderColor="$green8"
            borderWidth={1}
          >
            <Text color="$green11">
              Payment completed. Credits are applied when Paddle webhook confirmation arrives.
            </Text>
          </Card>
        )}

        {status === 'canceled' && (
          <Card
            padding="$4"
            backgroundColor="$orange3"
            borderColor="$orange8"
            borderWidth={1}
          >
            <Text color="$orange11">Checkout canceled. No billing changes were made.</Text>
          </Card>
        )}

        <XStack
          gap="$4"
          flexWrap="wrap"
        >
          <Card
            padding="$4"
            minWidth={220}
            flex={1}
          >
            <YStack gap="$2">
              <Text
                color="$color10"
                fontSize="$3"
              >
                Current Plan
              </Text>
              <Text
                fontSize="$6"
                fontWeight="bold"
              >
                {store?.subscriptionTier ?? 'No active subscription'}
              </Text>
            </YStack>
          </Card>

          <Card
            padding="$4"
            minWidth={220}
            flex={1}
          >
            <YStack gap="$2">
              <Text
                color="$color10"
                fontSize="$3"
              >
                Subscription Status
              </Text>
              <Text
                fontSize="$6"
                fontWeight="bold"
              >
                {store?.subscriptionStatus ?? 'n/a'}
              </Text>
            </YStack>
          </Card>

          <Card
            padding="$4"
            minWidth={220}
            flex={1}
          >
            <YStack gap="$2">
              <Text
                color="$color10"
                fontSize="$3"
              >
                Store Credits
              </Text>
              <Text
                fontSize="$6"
                fontWeight="bold"
              >
                {creditBalanceQuery.data?.balance ?? 0}
              </Text>
            </YStack>
          </Card>
        </XStack>

        <Separator />

        <YStack gap="$4">
          <H2>Subscription Plans</H2>
          <Text color="$color10">
            Tier includes monthly credits. When balance reaches zero, overage is billed
            automatically per tier.
          </Text>

          <XStack
            gap="$4"
            flexWrap="wrap"
          >
            {catalog &&
              (
                Object.entries(catalog.subscriptionTiers) as [
                  SubscriptionTier,
                  typeof catalog.subscriptionTiers.starter,
                ][]
              ).map(([tier, tierConfig]) => {
                const currentTier = store?.subscriptionTier as SubscriptionTier | null
                const isCurrent = currentTier === tier
                const hasSubscription = Boolean(store?.subscriptionId)
                const isUpgrade = Boolean(currentTier) && tierRank[tier] > tierRank[currentTier]

                return (
                  <Card
                    key={tier}
                    padding="$4"
                    minWidth={260}
                    flex={1}
                  >
                    <YStack gap="$3">
                      <H3>{tier[0]?.toUpperCase() + tier.slice(1)}</H3>
                      <Text color="$color10">
                        {formatUsdCents(tierConfig.monthlyPriceCents)} / month
                      </Text>
                      <Text color="$color10">{tierConfig.credits} included credits</Text>
                      <Text color="$color10">
                        Overage: {formatUsdCents(tierConfig.overageCents)} / credit
                      </Text>

                      {isCurrent ? (
                        <Button disabled>Current Plan</Button>
                      ) : hasSubscription ? (
                        <Button
                          onPress={() => handleChangePlan(tier)}
                          disabled={changePlan.isPending}
                        >
                          {changePlan.isPending
                            ? 'Updating...'
                            : isUpgrade
                              ? 'Upgrade'
                              : 'Downgrade'}
                        </Button>
                      ) : (
                        <Button
                          onPress={() => handleStartSubscription(tier)}
                          disabled={createCheckout.isPending}
                        >
                          {createCheckout.isPending ? 'Opening checkout...' : 'Start Subscription'}
                        </Button>
                      )}
                    </YStack>
                  </Card>
                )
              })}
          </XStack>
        </YStack>

        <Separator />

        <YStack gap="$4">
          <H2>Pay As You Go</H2>
          <Text color="$color10">
            Buy additional wholesale credits at{' '}
            {catalog ? formatUsdCents(catalog.payg.pricePerCreditCents) : '$0.18'} per credit.
          </Text>

          <Card padding="$4">
            <YStack gap="$3">
              <Text color="$color10">Credits to purchase</Text>
              <input
                type="number"
                min={1}
                max={5000}
                value={paygCredits}
                onChange={(event) => {
                  const parsed = Number(event.target.value)
                  if (!Number.isFinite(parsed)) {
                    return
                  }
                  const clamped = Math.max(1, Math.min(5000, Math.floor(parsed)))
                  setPaygCredits(clamped)
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #3f3f46',
                  backgroundColor: '#111114',
                  color: '#f4f4f5',
                  width: 220,
                }}
              />

              <Text
                color="$color12"
                fontWeight="600"
              >
                Total: {formatUsdCents(paygTotal)}
              </Text>

              <XStack>
                <Button
                  onPress={handlePaygCheckout}
                  disabled={createCheckout.isPending}
                >
                  {createCheckout.isPending ? 'Opening checkout...' : 'Buy Credits'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        </YStack>

        <Separator />

        <YStack gap="$4">
          <H2>Overage Usage History</H2>
          <Text color="$color10">Recent automatic overage charges for this store.</Text>

          <Card padding="$4">
            {overageUsage.length === 0 ? (
              <Text color="$color10">No overage usage recorded yet.</Text>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    color: 'inherit',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Credits</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overageUsage.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '8px', borderTop: '1px solid #2f2f35' }}>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'n/a'}
                        </td>
                        <td style={{ padding: '8px', borderTop: '1px solid #2f2f35' }}>
                          {row.amount}
                        </td>
                        <td style={{ padding: '8px', borderTop: '1px solid #2f2f35' }}>
                          {row.description}
                        </td>
                        <td style={{ padding: '8px', borderTop: '1px solid #2f2f35' }}>
                          {row.requestId ?? 'n/a'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </YStack>
      </PageContent>
    </YStack>
  )
}
