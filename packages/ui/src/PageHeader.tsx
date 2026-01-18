'use client'

import type { ReactNode } from 'react'
import { H1, Text, XStack, YStack } from 'tamagui'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <YStack gap="$2" paddingBottom="$4">
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2" flex={1}>
          <H1>{title}</H1>
          {subtitle && <Text color="$color10">{subtitle}</Text>}
        </YStack>

        {actions && (
          <XStack gap="$2" alignItems="center">
            {actions}
          </XStack>
        )}
      </XStack>
      <YStack height={1} backgroundColor="$borderColor" marginTop="$2" />
    </YStack>
  )
}
