'use client'

import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  Text,
  TextField,
} from '@shopify/polaris'
import { TitleBar } from '@shopify/app-bridge-react'
import { useCallback, useEffect, useState } from 'react'
import { useShopifyApi } from '../use-shopify-api'

interface TierInfo {
  code: string
  credits: number
  monthlyPriceCents: number
  overageCents: number
}

interface BillingCatalog {
  catalog: {
    subscriptionTiers: Record<string, TierInfo>
    payg: {
      pricePerCreditCents: number
      minCredits: number
      maxCredits: number
    }
  }
  store: {
    id: string
    subscriptionTier: string | null
    subscriptionId: string | null
    subscriptionStatus: string | null
    currentPeriodEnd: string | null
  }
}

interface OverageEntry {
  id: string
  amount: number
  description: string
  requestId: string | null
  createdAt: string | null
}

export default function ShopifyBillingPage() {
  const api = useShopifyApi()
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null)
  const [overageHistory, setOverageHistory] = useState<OverageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paygCredits, setPaygCredits] = useState('100')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [catalogRes, overageRes] = await Promise.all([
          api.get<BillingCatalog>('/billing-catalog'),
          api.get<OverageEntry[]>('/overage'),
        ])
        setCatalog(catalogRes)
        setOverageHistory(overageRes)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        setLoading(false)
      }
    }

    if (api.isReady) {
      loadData()
    }
  }, [api])

  const handleSubscribe = useCallback(
    async (tier: string) => {
      setActionLoading(tier)
      try {
        const result = await api.post<{ checkoutUrl: string }>('/checkout', {
          mode: 'subscription',
          tier,
        })
        if (result.checkoutUrl) {
          window.open(result.checkoutUrl, '_top')
        }
      } catch {
        setError('Failed to create checkout session')
      } finally {
        setActionLoading(null)
      }
    },
    [api]
  )

  const handleChangePlan = useCallback(
    async (targetTier: string) => {
      setActionLoading(`change-${targetTier}`)
      try {
        await api.post('/change-plan', { targetTier })
        // Reload billing data
        const catalogRes = await api.get<BillingCatalog>('/billing-catalog')
        setCatalog(catalogRes)
      } catch {
        setError('Failed to change plan')
      } finally {
        setActionLoading(null)
      }
    },
    [api]
  )

  const handlePaygPurchase = useCallback(async () => {
    const credits = Number.parseInt(paygCredits, 10)
    if (!credits || credits < 1 || credits > 5000) {
      setError('Credits must be between 1 and 5000')
      return
    }

    setActionLoading('payg')
    try {
      const result = await api.post<{ checkoutUrl: string }>('/checkout', {
        mode: 'payg',
        credits,
      })
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, '_top')
      }
    } catch {
      setError('Failed to create checkout session')
    } finally {
      setActionLoading(null)
    }
  }, [api, paygCredits])

  if (loading || !api.isReady) {
    return (
      <Page title="Billing" backAction={{ url: '/shopify' }}>
        <TitleBar title="Billing" />
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    )
  }

  const tiers = catalog?.catalog.subscriptionTiers
  const currentTier = catalog?.store.subscriptionTier
  const hasSubscription = !!catalog?.store.subscriptionId

  const overageRows = overageHistory.map((entry) => [
    entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—',
    entry.amount,
    entry.description,
  ])

  return (
    <Page title="Billing" backAction={{ url: '/shopify' }}>
      <TitleBar title="Billing" />
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}

        <Text as="h2" variant="headingLg">
          Subscription Plans
        </Text>

        <Layout>
          {tiers &&
            Object.entries(tiers).map(([key, tier]) => {
              const isCurrent = currentTier === key
              const price = (tier.monthlyPriceCents / 100).toFixed(0)

              return (
                <Layout.Section key={key} variant="oneThird">
                  <Card>
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingMd">
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </Text>
                        {isCurrent && (
                          <Text as="span" variant="bodySm" tone="success" fontWeight="semibold">
                            Current
                          </Text>
                        )}
                      </InlineStack>
                      <Text as="p" variant="headingXl">
                        ${price}
                        <Text as="span" variant="bodyMd" tone="subdued">
                          /mo
                        </Text>
                      </Text>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd">
                          {tier.credits} credits/month
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          ${(tier.overageCents / 100).toFixed(2)} per overage credit
                        </Text>
                      </BlockStack>
                      {isCurrent ? (
                        <Button disabled>Current plan</Button>
                      ) : hasSubscription ? (
                        <Button
                          onClick={() => handleChangePlan(key)}
                          loading={actionLoading === `change-${key}`}
                        >
                          {currentTier && ['starter', 'growth', 'scale'].indexOf(key) >
                            ['starter', 'growth', 'scale'].indexOf(currentTier)
                            ? 'Upgrade'
                            : 'Downgrade'}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleSubscribe(key)}
                          loading={actionLoading === key}
                        >
                          Subscribe
                        </Button>
                      )}
                    </BlockStack>
                  </Card>
                </Layout.Section>
              )
            })}
        </Layout>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Pay-As-You-Go Credits
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Purchase credits at ${((catalog?.catalog.payg.pricePerCreditCents ?? 18) / 100).toFixed(2)} per credit.
            </Text>
            <InlineStack gap="300" blockAlign="end">
              <div style={{ maxWidth: 200 }}>
                <TextField
                  label="Credits"
                  type="number"
                  value={paygCredits}
                  onChange={setPaygCredits}
                  min={1}
                  max={5000}
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={handlePaygPurchase}
                loading={actionLoading === 'payg'}
              >
                Purchase
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {overageHistory.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Overage Usage
              </Text>
              <DataTable
                columnContentTypes={['text', 'numeric', 'text']}
                headings={['Date', 'Credits', 'Description']}
                rows={overageRows}
              />
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  )
}
