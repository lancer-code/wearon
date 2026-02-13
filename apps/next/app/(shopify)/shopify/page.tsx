'use client'

import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Link,
  Page,
  SkeletonBodyText,
  Text,
} from '@shopify/polaris'
import { TitleBar } from '@shopify/app-bridge-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useShopifyApi } from './use-shopify-api'

interface StoreData {
  id: string
  shopDomain: string
  billingMode: string
  subscriptionTier: string | null
  subscriptionStatus: string | null
  status: string
  onboardingCompleted: boolean
}

interface CreditData {
  balance: number
  totalPurchased: number
  totalSpent: number
}

interface ApiKeyData {
  maskedKey: string | null
  createdAt: string | null
}

export default function ShopifyDashboard() {
  const api = useShopifyApi()
  const [store, setStore] = useState<StoreData | null>(null)
  const [credits, setCredits] = useState<CreditData | null>(null)
  const [apiKey, setApiKey] = useState<ApiKeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function loadData() {
      try {
        const [storeRes, creditsRes, apiKeyRes] = await Promise.all([
          api.get<StoreData>(''),
          api.get<CreditData>('/credits'),
          api.get<ApiKeyData>('/api-key'),
        ])
        setStore(storeRes)
        setCredits(creditsRes)
        setApiKey(apiKeyRes)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load store data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [api])

  const [newPlaintextKey, setNewPlaintextKey] = useState<string | null>(null)

  const handleRegenerateKey = useCallback(async () => {
    const confirmed = window.confirm(
      apiKey?.maskedKey
        ? 'Regenerating will immediately invalidate your current API key. Any integrations using the old key will stop working. Continue?'
        : 'Generate a new API key for this store?'
    )
    if (!confirmed) return

    try {
      const result = await api.post<{ apiKey: string }>('/api-key/regenerate')
      setNewPlaintextKey(result.apiKey)
      setApiKey({ maskedKey: `${result.apiKey.substring(0, 16)}...****`, createdAt: new Date().toISOString() })
    } catch {
      setError('Failed to regenerate API key')
    }
  }, [api, apiKey?.maskedKey])

  const handleCopyKey = useCallback(() => {
    if (newPlaintextKey) {
      navigator.clipboard.writeText(newPlaintextKey)
    }
  }, [newPlaintextKey])

  if (loading) {
    return (
      <Page>
        <TitleBar title="WearOn Ai" />
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

  if (error) {
    return (
      <Page>
        <TitleBar title="WearOn Ai" />
        <Layout>
          <Layout.Section>
            <Banner tone="critical" title="Error loading dashboard">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    )
  }

  const tierLabel = store?.subscriptionTier
    ? store.subscriptionTier.charAt(0).toUpperCase() + store.subscriptionTier.slice(1)
    : 'None'

  const billingModeLabel = store?.billingMode === 'resell_mode' ? 'Resell' : 'Absorb'

  return (
    <Page>
      <TitleBar title="WearOn Ai" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Store Overview
                </Text>
                <InlineStack gap="400" align="start">
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Shop
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {store?.shopDomain ?? '—'}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Status
                    </Text>
                    <Badge tone={store?.status === 'active' ? 'success' : 'attention'}>
                      {store?.status ?? 'unknown'}
                    </Badge>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Plan
                    </Text>
                    <Badge>{tierLabel}</Badge>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Billing Mode
                    </Text>
                    <Badge tone="info">{billingModeLabel}</Badge>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Credits
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="headingXl">
                    {credits?.balance ?? 0}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    available credits
                  </Text>
                </BlockStack>
                <InlineStack gap="400">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Purchased
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {credits?.totalPurchased ?? 0}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Spent
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {credits?.totalSpent ?? 0}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Link url="/shopify/billing">Manage billing</Link>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  API Key
                </Text>
                {newPlaintextKey ? (
                  <Banner tone="warning" title="Save your API key now" onDismiss={() => setNewPlaintextKey(null)}>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        This is the only time your full API key will be shown. Copy it now.
                      </Text>
                      <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{newPlaintextKey}</code>
                    </BlockStack>
                  </Banner>
                ) : null}
                {apiKey?.maskedKey ? (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      <code>{apiKey.maskedKey}</code>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Created: {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : '—'}
                    </Text>
                  </BlockStack>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No API key generated yet.
                  </Text>
                )}
                <InlineStack gap="300">
                  {newPlaintextKey && (
                    <Button variant="primary" onClick={handleCopyKey}>
                      Copy API key
                    </Button>
                  )}
                  <Button onClick={handleRegenerateKey}>
                    {apiKey?.maskedKey ? 'Regenerate API key' : 'Generate API key'}
                  </Button>
                  <Link url="/shopify/settings">Settings</Link>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  )
}
