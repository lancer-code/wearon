'use client'

import { useState } from 'react'
import { YStack, XStack, Text, Card, PageHeader, PageContent, PageFooter, Button, Spinner } from '@my/ui'
import { Store, Activity, CreditCard, ChevronLeft, ChevronRight, AlertTriangle } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'
import { useRouter } from 'solito/navigation'

function OverviewCard({
  title,
  value,
  icon: Icon,
  isLoading,
  variant,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  isLoading: boolean
  variant?: 'danger'
}) {
  return (
    <Card padding="$4" flex={1} minWidth={200}>
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <Icon size={16} color={variant === 'danger' ? '$red10' : '$color10'} />
          <Text color={variant === 'danger' ? '$red10' : '$color10'} fontSize="$3">
            {title}
          </Text>
        </XStack>
        <Text fontSize="$8" fontWeight="bold" color={variant === 'danger' ? '$red10' : undefined}>
          {isLoading ? '...' : value}
        </Text>
      </YStack>
    </Card>
  )
}

export function AdminB2BAnalytics() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [churnRiskOnly, setChurnRiskOnly] = useState(false)
  const limit = 20

  const { data: overview, isLoading: overviewLoading } =
    trpc.analytics.getB2BOverview.useQuery({})

  const { data: breakdown, isLoading: breakdownLoading } =
    trpc.analytics.getStoreBreakdown.useQuery({ page, limit, churnRiskOnly })

  const totalPages = breakdown ? Math.ceil(breakdown.total / limit) : 0

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <PageHeader
        title="B2B Analytics"
        subtitle="Monitor platform health and store performance"
      />

      <PageContent>
        {/* Overview Cards */}
        <XStack gap="$4" flexWrap="wrap">
          <OverviewCard
            title="Active Stores"
            value={overview?.totalActiveStores ?? 0}
            icon={Store}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Total Generations"
            value={overview?.totalGenerations ?? 0}
            icon={Activity}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Credits Consumed"
            value={overview?.totalCreditsConsumed ?? 0}
            icon={CreditCard}
            isLoading={overviewLoading}
          />
          <OverviewCard
            title="Churn Risk"
            value={overview?.churnRiskCount ?? 0}
            icon={AlertTriangle}
            isLoading={overviewLoading}
            variant={(overview?.churnRiskCount ?? 0) > 0 ? 'danger' : undefined}
          />
        </XStack>

        {/* Store Breakdown Table */}
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$6" fontWeight="600">
              Store Breakdown
            </Text>
            <Button
              size="$2"
              variant={churnRiskOnly ? undefined : 'outlined'}
              theme={churnRiskOnly ? 'red' : undefined}
              onPress={() => {
                setChurnRiskOnly((v) => !v)
                setPage(0)
              }}
            >
              <AlertTriangle size={14} />
              {churnRiskOnly ? 'Showing Churn Risk Only' : 'Filter Churn Risk'}
            </Button>
          </XStack>

          {breakdownLoading ? (
            <YStack padding="$6" alignItems="center">
              <Spinner size="large" />
            </YStack>
          ) : (
            <Card bordered padding="$0" overflow="hidden">
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                    fontFamily:
                      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#18181b',
                        borderBottom: '1px solid #27272a',
                      }}
                    >
                      <th style={thStyle}>Store</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Risk</th>
                      <th style={thStyle}>Billing</th>
                      <th style={thStyle}>Tier</th>
                      <th style={thStyle}>Credits</th>
                      <th style={thStyle}>Generations</th>
                      <th style={thStyle}>Last Gen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown?.stores.map((store) => (
                      <tr
                        key={store.store_id}
                        onClick={() =>
                          router.push(`/admin/stores/${store.store_id}`)
                        }
                        style={{
                          borderBottom: '1px solid #27272a',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1f1f23'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <td style={tdStyle}>{store.shop_domain}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              backgroundColor:
                                store.status === 'active'
                                  ? '#052e16'
                                  : '#450a0a',
                              color:
                                store.status === 'active'
                                  ? '#4ade80'
                                  : '#f87171',
                            }}
                          >
                            {store.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {store.is_churn_risk ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                backgroundColor: '#450a0a',
                                color: '#f87171',
                              }}
                            >
                              Churn Risk
                            </span>
                          ) : (
                            <span style={{ color: '#71717a', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}>{store.billing_mode.replace('_mode', '')}</td>
                        <td style={tdStyle}>{store.subscription_tier || '—'}</td>
                        <td style={tdStyle}>{store.credit_balance}</td>
                        <td style={tdStyle}>{store.generation_count}</td>
                        <td style={tdStyle}>
                          {store.last_generation_at
                            ? new Date(store.last_generation_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {(!breakdown?.stores || breakdown.stores.length === 0) && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            ...tdStyle,
                            textAlign: 'center',
                            color: '#71717a',
                          }}
                        >
                          {churnRiskOnly ? 'No stores at churn risk' : 'No stores found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <XStack justifyContent="space-between" alignItems="center">
              <Text color="$color8" fontSize="$2">
                Page {page + 1} of {totalPages} ({breakdown?.total} stores)
              </Text>
              <XStack gap="$2">
                <Button
                  size="$2"
                  variant="outlined"
                  disabled={page === 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Prev
                </Button>
                <Button
                  size="$2"
                  variant="outlined"
                  disabled={page >= totalPages - 1}
                  onPress={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </XStack>
            </XStack>
          )}
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
