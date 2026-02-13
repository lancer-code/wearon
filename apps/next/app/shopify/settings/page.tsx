'use client'

import {
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  Layout,
  Page,
  SkeletonBodyText,
  Text,
  TextField,
} from '@shopify/polaris'
import { TitleBar } from '@shopify/app-bridge-react'
import { useCallback, useEffect, useState } from 'react'
import { useShopifyApi } from '../use-shopify-api'

interface StoreConfig {
  storeId: string
  shopDomain: string
  billingMode: string
  retailCreditPrice: number | null
  subscriptionTier: string | null
  status: string
}

export default function ShopifySettingsPage() {
  const api = useShopifyApi()
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [billingMode, setBillingMode] = useState<string[]>(['absorb_mode'])
  const [retailPrice, setRetailPrice] = useState('')

  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await api.get<StoreConfig>('/config')
        setConfig(result)
        setBillingMode([result.billingMode])
        setRetailPrice(result.retailCreditPrice?.toString() ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    if (api.isReady) {
      loadConfig()
    }
  }, [api])

  const handleSave = useCallback(async () => {
    const selectedMode = billingMode[0] ?? 'absorb_mode'

    if (selectedMode === 'resell_mode') {
      const price = Number.parseFloat(retailPrice)
      if (!price || price <= 0) {
        setError('Retail credit price must be a positive number for resell mode.')
        return
      }
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await api.patch<StoreConfig>('/config', {
        billing_mode: selectedMode,
        retail_credit_price: selectedMode === 'resell_mode' ? Number.parseFloat(retailPrice) : null,
      })
      setConfig(result)
      setSuccess(true)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [api, billingMode, retailPrice])

  if (loading || !api.isReady) {
    return (
      <Page title="Settings" backAction={{ url: '/shopify' }}>
        <TitleBar title="Settings" />
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

  const selectedMode = billingMode[0] ?? 'absorb_mode'
  const showRetailPrice = selectedMode === 'resell_mode'

  return (
    <Page title="Settings" backAction={{ url: '/shopify' }}>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}
        {success && (
          <Banner tone="success" onDismiss={() => setSuccess(false)}>
            <p>Settings saved successfully.</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Billing Mode
            </Text>
            <ChoiceList
              title=""
              selected={billingMode}
              onChange={setBillingMode}
              choices={[
                {
                  label: 'Absorb mode (free shopper try-on)',
                  value: 'absorb_mode',
                  helpText: 'Your store absorbs generation costs. Shoppers use try-on for free.',
                },
                {
                  label: 'Resell mode (sell credits to shoppers)',
                  value: 'resell_mode',
                  helpText: 'Shoppers pay per credit at your configured retail price.',
                },
              ]}
            />

            {showRetailPrice && (
              <TextField
                label="Retail credit price (USD)"
                type="number"
                value={retailPrice}
                onChange={setRetailPrice}
                min={0.01}
                step={0.01}
                autoComplete="off"
                helpText="Price per credit in USD (e.g., 0.50)"
              />
            )}

            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save settings
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Store Information
            </Text>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                <Text as="span" tone="subdued">
                  Shop domain:{' '}
                </Text>
                {config?.shopDomain ?? '—'}
              </Text>
              <Text as="p" variant="bodyMd">
                <Text as="span" tone="subdued">
                  Subscription:{' '}
                </Text>
                {config?.subscriptionTier
                  ? config.subscriptionTier.charAt(0).toUpperCase() + config.subscriptionTier.slice(1)
                  : 'None'}
              </Text>
              <Text as="p" variant="bodyMd">
                <Text as="span" tone="subdued">
                  Status:{' '}
                </Text>
                {config?.status ?? '—'}
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  )
}
