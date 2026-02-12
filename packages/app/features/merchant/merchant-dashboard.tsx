'use client'

import { useState } from 'react'
import { YStack, XStack, H2, Text, Card, Separator, PageHeader, PageContent, Button } from '@my/ui'
import { Copy, Eye, EyeOff, RefreshCw } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

export function MerchantDashboard() {
  const [showKey, setShowKey] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)

  const storeQuery = trpc.merchant.getMyStore.useQuery()
  const apiKeyQuery = trpc.merchant.getApiKeyPreview.useQuery()
  const creditsQuery = trpc.merchant.getCreditBalance.useQuery()
  const regenerateKey = trpc.merchant.regenerateApiKey.useMutation({
    onSuccess: (data) => {
      setNewApiKey(data.apiKey)
      setShowRegenerateConfirm(false)
      apiKeyQuery.refetch()
    },
  })

  const store = storeQuery.data
  const apiKeyPreview = apiKeyQuery.data?.maskedKey ?? '••••••••••••••••'
  const creditBalance = creditsQuery.data?.balance ?? 0

  const handleCopyKey = async () => {
    if (apiKeyQuery.data?.maskedKey) {
      await navigator.clipboard.writeText(apiKeyQuery.data.maskedKey)
      setJustCopied(true)
      setTimeout(() => setJustCopied(false), 2000)
    }
  }

  const handleCopyNewKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey)
      setJustCopied(true)
      setTimeout(() => setJustCopied(false), 2000)
    }
  }

  return (
    <YStack flex={1} padding="$6" gap="$6" style={{ overflowY: 'auto' }}>
      <PageHeader
        title="Dashboard"
        subtitle={store?.shopDomain ? `Store: ${store.shopDomain}` : 'Loading...'}
      />

      <PageContent>
        {/* Store Overview Cards */}
        <XStack gap="$4" flexWrap="wrap">
          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                Store Status
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {store?.status === 'active' ? 'Active' : store?.status ?? '--'}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                Credit Balance
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {creditBalance}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                Subscription Tier
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {store?.subscriptionTier ?? 'None'}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">
                Billing Mode
              </Text>
              <Text fontSize="$6" fontWeight="bold">
                {store?.billingMode === 'absorb_mode' ? 'Absorb' : store?.billingMode === 'resell_mode' ? 'Resell' : '--'}
              </Text>
            </YStack>
          </Card>
        </XStack>

        <Separator />

        {/* API Key Section */}
        <YStack gap="$4">
          <H2>API Key</H2>
          <Card padding="$4">
            <YStack gap="$3">
              <Text color="$color10" fontSize="$3">
                Your API key is used by the Shopify plugin to authenticate with WearOn.
              </Text>
              <XStack gap="$2" alignItems="center">
                <div
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    backgroundColor: '#18181b',
                    borderRadius: 6,
                    border: '1px solid #27272a',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    color: '#fafafa',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showKey ? apiKeyPreview : '••••••••••••••••••••••••'}
                </div>
                <button
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                  style={{
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #27272a',
                    backgroundColor: 'transparent',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={handleCopyKey}
                  type="button"
                  style={{
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #27272a',
                    backgroundColor: 'transparent',
                    color: justCopied ? '#22c55e' : '#a1a1aa',
                    cursor: 'pointer',
                  }}
                  title="Copy masked key"
                >
                  <Copy size={16} />
                </button>
              </XStack>
              <XStack gap="$2" paddingTop="$1">
                <Button
                  size="$3"
                  variant="outlined"
                  icon={<RefreshCw size={14} />}
                  onPress={() => setShowRegenerateConfirm(true)}
                >
                  Regenerate
                </Button>
              </XStack>

              <Text color="$color8" fontSize="$2">
                Only the masked version is shown. Regenerating creates a new key and invalidates the old one.
              </Text>

              {/* Regenerate Confirmation Dialog */}
              {showRegenerateConfirm && (
                <Card padding="$4" backgroundColor="$color3" borderColor="$orange8" borderWidth={1}>
                  <YStack gap="$3">
                    <Text fontWeight="600" color="$orange10">
                      Are you sure you want to regenerate your API key?
                    </Text>
                    <Text color="$color10" fontSize="$3">
                      This will invalidate your current key. Any Shopify plugins using the old key will stop working until updated.
                    </Text>
                    <XStack gap="$2">
                      <Button
                        size="$3"
                        theme="red"
                        onPress={() => regenerateKey.mutate()}
                        disabled={regenerateKey.isPending}
                      >
                        {regenerateKey.isPending ? 'Regenerating...' : 'Yes, Regenerate'}
                      </Button>
                      <Button
                        size="$3"
                        variant="outlined"
                        onPress={() => setShowRegenerateConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              )}

              {/* New API Key Display (one-time) */}
              {newApiKey && (
                <Card padding="$4" backgroundColor="$color3" borderColor="$green8" borderWidth={1}>
                  <YStack gap="$3">
                    <Text fontWeight="600" color="$green10">
                      New API Key Generated (save this now!)
                    </Text>
                    <Text color="$color9" fontSize="$2">
                      This is the only time your new key will be shown. Copy and store it securely.
                    </Text>
                    <XStack gap="$2" alignItems="center">
                      <div
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          backgroundColor: '#18181b',
                          borderRadius: 6,
                          border: '1px solid #27272a',
                          fontFamily: 'monospace',
                          fontSize: 14,
                          color: '#fafafa',
                          wordBreak: 'break-all',
                        }}
                      >
                        {newApiKey}
                      </div>
                      <button
                        onClick={handleCopyNewKey}
                        type="button"
                        style={{
                          padding: '10px',
                          borderRadius: 6,
                          border: '1px solid #27272a',
                          backgroundColor: 'transparent',
                          color: justCopied ? '#22c55e' : '#a1a1aa',
                          cursor: 'pointer',
                        }}
                        title="Copy new API key"
                      >
                        <Copy size={16} />
                      </button>
                    </XStack>
                  </YStack>
                </Card>
              )}
            </YStack>
          </Card>
        </YStack>

        <Separator />

        {/* Store Configuration */}
        <YStack gap="$4">
          <H2>Store Configuration</H2>
          <Card padding="$4">
            <YStack gap="$3">
              <XStack justifyContent="space-between">
                <Text color="$color10">Shop Domain</Text>
                <Text>{store?.shopDomain ?? '--'}</Text>
              </XStack>
              <Separator />
              <XStack justifyContent="space-between">
                <Text color="$color10">Onboarding</Text>
                <Text>{store?.onboardingCompleted ? 'Completed' : 'Pending'}</Text>
              </XStack>
              <Separator />
              <XStack justifyContent="space-between">
                <Text color="$color10">Billing Mode</Text>
                <Text>
                  {store?.billingMode === 'absorb_mode' ? 'Absorb (merchant pays)' : store?.billingMode === 'resell_mode' ? 'Resell (shopper pays)' : '--'}
                </Text>
              </XStack>
            </YStack>
          </Card>
        </YStack>
      </PageContent>
    </YStack>
  )
}
