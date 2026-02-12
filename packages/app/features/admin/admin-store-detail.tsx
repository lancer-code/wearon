'use client'

import { useState } from 'react'
import { YStack, XStack, Text, Card, PageHeader, PageContent, PageFooter, Button, Spinner, Separator } from '@my/ui'
import { ChevronLeft, ChevronRight, ArrowLeft } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'
import { useRouter } from 'solito/navigation'

interface AdminStoreDetailProps {
  storeId: string
}

export function AdminStoreDetail({ storeId }: AdminStoreDetailProps) {
  const router = useRouter()
  const [genPage, setGenPage] = useState(0)
  const [txPage, setTxPage] = useState(0)
  const pageLimit = 20

  const { data, isLoading, error } = trpc.analytics.getStoreDetail.useQuery({
    storeId,
    generationPage: genPage,
    generationLimit: pageLimit,
    transactionPage: txPage,
    transactionLimit: pageLimit,
  })

  if (isLoading) {
    return (
      <YStack flex={1} padding="$6" alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (error || !data) {
    return (
      <YStack flex={1} padding="$6" gap="$4">
        <Button size="$3" variant="outlined" onPress={() => router.push('/admin/b2b-analytics')}>
          <ArrowLeft size={16} />
          Back to B2B Analytics
        </Button>
        <Text color="$red10">
          {error?.message || 'Store not found'}
        </Text>
      </YStack>
    )
  }

  const { store, credits, hasActiveApiKey, generations, transactions } = data
  const genTotalPages = Math.ceil(generations.total / pageLimit)
  const txTotalPages = Math.ceil(transactions.total / pageLimit)

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <XStack alignItems="center" gap="$3">
        <Button
          size="$2"
          variant="outlined"
          onPress={() => router.push('/admin/b2b-analytics')}
        >
          <ArrowLeft size={14} />
        </Button>
        <PageHeader
          title={store.shopDomain}
          subtitle={`Store ID: ${store.id}`}
        />
      </XStack>

      <PageContent>
        {/* Store Config */}
        <XStack gap="$4" flexWrap="wrap">
          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Status</Text>
              <Text fontSize="$5" fontWeight="bold">
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 14,
                    backgroundColor:
                      store.status === 'active' ? '#052e16' : '#450a0a',
                    color: store.status === 'active' ? '#4ade80' : '#f87171',
                  }}
                >
                  {store.status}
                </span>
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Credit Balance</Text>
              <Text fontSize="$8" fontWeight="bold">{credits.balance}</Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Subscription Tier</Text>
              <Text fontSize="$5" fontWeight="bold">
                {store.subscriptionTier || '—'}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">API Key</Text>
              <Text fontSize="$5" fontWeight="bold">
                {hasActiveApiKey ? 'Active' : 'None'}
              </Text>
            </YStack>
          </Card>
        </XStack>

        {/* Store Details Row */}
        <XStack gap="$4" flexWrap="wrap">
          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Billing Mode</Text>
              <Text fontSize="$5" fontWeight="bold">
                {store.billingMode.replace('_mode', '')}
              </Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Total Purchased</Text>
              <Text fontSize="$5" fontWeight="bold">{credits.totalPurchased}</Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Total Spent</Text>
              <Text fontSize="$5" fontWeight="bold">{credits.totalSpent}</Text>
            </YStack>
          </Card>

          <Card padding="$4" flex={1} minWidth={200}>
            <YStack gap="$2">
              <Text color="$color10" fontSize="$3">Onboarding</Text>
              <Text fontSize="$5" fontWeight="bold">
                {store.onboardingCompleted ? 'Complete' : 'Pending'}
              </Text>
            </YStack>
          </Card>
        </XStack>

        <Separator />

        {/* Generation History */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            Generation History ({generations.total})
          </Text>

          <Card bordered padding="$0" overflow="hidden">
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Credits</th>
                    <th style={thStyle}>Processing (ms)</th>
                    <th style={thStyle}>Request ID</th>
                    <th style={thStyle}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.items.map((gen) => (
                    <tr key={gen.id} style={rowStyle}>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle(gen.status)}>
                          {gen.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{gen.credits_used}</td>
                      <td style={tdStyle}>{gen.processing_time_ms ?? '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace' }}>
                        {gen.request_id ? gen.request_id.substring(0, 16) + '...' : '—'}
                      </td>
                      <td style={tdStyle}>
                        {new Date(gen.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {generations.items.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#71717a' }}>
                        No generations found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {genTotalPages > 1 && (
            <XStack justifyContent="flex-end" gap="$2">
              <Button
                size="$2"
                variant="outlined"
                disabled={genPage === 0}
                onPress={() => setGenPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <Text color="$color8" fontSize="$2" alignSelf="center">
                {genPage + 1} / {genTotalPages}
              </Text>
              <Button
                size="$2"
                variant="outlined"
                disabled={genPage >= genTotalPages - 1}
                onPress={() => setGenPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </XStack>
          )}
        </YStack>

        <Separator />

        {/* Credit Transaction History */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            Credit Transactions ({transactions.total})
          </Text>

          <Card bordered padding="$0" overflow="hidden">
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Request ID</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.items.map((tx) => (
                    <tr key={tx.id} style={rowStyle}>
                      <td style={tdStyle}>
                        <span style={typeBadgeStyle(tx.type)}>
                          {tx.type}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: tx.amount > 0 ? '#4ade80' : '#f87171',
                          fontWeight: 600,
                        }}
                      >
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td style={tdStyle}>{tx.description || '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace' }}>
                        {tx.request_id ? tx.request_id.substring(0, 16) + '...' : '—'}
                      </td>
                      <td style={tdStyle}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {transactions.items.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#71717a' }}>
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {txTotalPages > 1 && (
            <XStack justifyContent="flex-end" gap="$2">
              <Button
                size="$2"
                variant="outlined"
                disabled={txPage === 0}
                onPress={() => setTxPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <Text color="$color8" fontSize="$2" alignSelf="center">
                {txPage + 1} / {txTotalPages}
              </Text>
              <Button
                size="$2"
                variant="outlined"
                disabled={txPage >= txTotalPages - 1}
                onPress={() => setTxPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </XStack>
          )}
        </YStack>
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Store created: {new Date(store.createdAt).toLocaleDateString()}
        </Text>
      </PageFooter>
    </YStack>
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#18181b',
  borderBottom: '1px solid #27272a',
}

const rowStyle: React.CSSProperties = {
  borderBottom: '1px solid #27272a',
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#a1a1aa',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#fafafa',
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    completed: { bg: '#052e16', text: '#4ade80' },
    failed: { bg: '#450a0a', text: '#f87171' },
    queued: { bg: '#1e1b4b', text: '#a5b4fc' },
    processing: { bg: '#422006', text: '#fbbf24' },
  }
  const c = colors[status] || { bg: '#27272a', text: '#a1a1aa' }
  return {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: c.bg,
    color: c.text,
  }
}

function typeBadgeStyle(type: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    purchase: { bg: '#052e16', text: '#4ade80' },
    subscription: { bg: '#052e16', text: '#4ade80' },
    deduction: { bg: '#450a0a', text: '#f87171' },
    refund: { bg: '#422006', text: '#fbbf24' },
    overage: { bg: '#4a1d96', text: '#c4b5fd' },
  }
  const c = colors[type] || { bg: '#27272a', text: '#a1a1aa' }
  return {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: c.bg,
    color: c.text,
  }
}
