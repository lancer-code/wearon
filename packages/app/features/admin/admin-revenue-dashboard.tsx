'use client'

import { useState } from 'react'
import { YStack, XStack, Text, Card, PageHeader, PageContent, PageFooter, Spinner } from '@my/ui'
import { DollarSign, TrendingUp, Activity, ShieldAlert, RefreshCw, Clock } from '@tamagui/lucide-icons'
import { trpc } from '../../utils/trpc'

function OverviewCard({
  title,
  value,
  icon: Icon,
  isLoading,
  subtitle,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  isLoading: boolean
  subtitle?: string
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
        {subtitle && (
          <Text color="$color8" fontSize="$2">
            {subtitle}
          </Text>
        )}
      </YStack>
    </Card>
  )
}

export function AdminRevenueDashboard() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filterInput =
    startDate || endDate
      ? { startDate: startDate || undefined, endDate: endDate || undefined }
      : undefined

  const { data: revenue, isLoading: revenueLoading } =
    trpc.analytics.getRevenueOverview.useQuery(filterInput)

  const { data: quality, isLoading: qualityLoading } =
    trpc.analytics.getQualityMetrics.useQuery(filterInput)

  return (
    <YStack flex={1} padding="$6" gap="$6">
      <PageHeader
        title="Revenue & Quality"
        subtitle="Platform revenue, costs, margins, and generation quality metrics"
      />

      <PageContent>
        {/* Date Range Filter */}
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <Text color="$color10" fontSize="$3">
            Filter:
          </Text>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={dateInputStyle}
            placeholder="Start date"
          />
          <Text color="$color8">to</Text>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={dateInputStyle}
            placeholder="End date"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              style={clearButtonStyle}
            >
              Clear
            </button>
          )}
        </XStack>

        {/* Revenue Section */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            Revenue
          </Text>
          <XStack gap="$4" flexWrap="wrap">
            <OverviewCard
              title="B2B Revenue"
              value={revenue ? `$${revenue.b2bRevenue.toLocaleString()}` : '$0'}
              icon={DollarSign}
              isLoading={revenueLoading}
              subtitle="Wholesale credit purchases"
            />
            <OverviewCard
              title="B2C Revenue"
              value={revenue ? `$${revenue.b2cRevenue.toLocaleString()}` : '$0'}
              icon={DollarSign}
              isLoading={revenueLoading}
              subtitle="Credit pack purchases"
            />
            <OverviewCard
              title="Est. OpenAI Costs"
              value={revenue ? `$${revenue.estimatedCosts.toLocaleString()}` : '$0'}
              icon={TrendingUp}
              isLoading={revenueLoading}
              subtitle={revenue ? `$${revenue.costPerGeneration}/gen` : ''}
            />
            <OverviewCard
              title="Margin"
              value={revenue ? `${revenue.marginPercentage}%` : '0%'}
              icon={TrendingUp}
              isLoading={revenueLoading}
              subtitle={revenue ? `Total: $${revenue.totalRevenue.toLocaleString()}` : ''}
            />
          </XStack>
        </YStack>

        {/* Quality Section */}
        <YStack gap="$3">
          <Text fontSize="$6" fontWeight="600">
            Quality Metrics
          </Text>
          <XStack gap="$4" flexWrap="wrap">
            <OverviewCard
              title="Success Rate"
              value={quality ? `${(quality.successRate * 100).toFixed(1)}%` : '0%'}
              icon={Activity}
              isLoading={qualityLoading}
              subtitle={
                quality
                  ? `${quality.totalCompleted} / ${quality.totalSessions} sessions`
                  : ''
              }
            />
            <OverviewCard
              title="Moderation Blocks"
              value={quality?.moderationBlockCount ?? 0}
              icon={ShieldAlert}
              isLoading={qualityLoading}
            />
            <OverviewCard
              title="Refunds"
              value={quality?.refundCount ?? 0}
              icon={RefreshCw}
              isLoading={qualityLoading}
            />
            <OverviewCard
              title="Avg Gen Time"
              value={
                quality && quality.avgGenerationTimeMs > 0
                  ? `${(quality.avgGenerationTimeMs / 1000).toFixed(1)}s`
                  : '—'
              }
              icon={Clock}
              isLoading={qualityLoading}
            />
          </XStack>
        </YStack>

        {/* Channel Breakdown Table */}
        {quality?.channelBreakdown && (
          <YStack gap="$3">
            <Text fontSize="$6" fontWeight="600">
              Channel Breakdown
            </Text>
            <Card bordered padding="$0" overflow="hidden">
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={headerRowStyle}>
                      <th style={thStyle}>Channel</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}>Completed</th>
                      <th style={thStyle}>Failed</th>
                      <th style={thStyle}>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={rowStyle}>
                      <td style={tdStyle}>B2B (Stores)</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2b.total}</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2b.completed}</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2b.failed}</td>
                      <td style={tdStyle}>
                        {(quality.channelBreakdown.b2b.successRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={rowStyle}>
                      <td style={tdStyle}>B2C (Users)</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2c.total}</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2c.completed}</td>
                      <td style={tdStyle}>{quality.channelBreakdown.b2c.failed}</td>
                      <td style={tdStyle}>
                        {(quality.channelBreakdown.b2c.successRate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </YStack>
        )}
      </PageContent>

      <PageFooter>
        <Text color="$color8" fontSize="$2">
          Data updated: just now
        </Text>
      </PageFooter>
    </YStack>
  )
}

const dateInputStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #27272a',
  backgroundColor: '#09090b',
  color: '#fafafa',
  fontSize: 14,
  fontFamily: 'inherit',
}

const clearButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #27272a',
  backgroundColor: 'transparent',
  color: '#a1a1aa',
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const headerRowStyle: React.CSSProperties = {
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
