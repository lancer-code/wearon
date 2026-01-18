'use client'

import type { ReactNode } from 'react'
import { Text, XStack, YStack } from 'tamagui'
import { Link } from 'solito/link'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: ReactNode
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: ReactNode
}

export function Breadcrumb({ items, separator = '>' }: BreadcrumbProps) {
  if (!items || items.length === 0) return null

  return (
    <YStack>
      <XStack gap="$2" alignItems="center" paddingVertical={21.5} paddingHorizontal="$6">
        {items.map((item, index) => (
          <XStack key={index} gap="$2" alignItems="center">
            {index > 0 && (
              <Text color="$color9" fontSize="$2">
                {separator}
              </Text>
            )}
            {item.icon && item.icon}
            {item.href ? (
              <Link href={item.href} style={{ textDecoration: 'none' }}>
                <Text
                  color="$color10"
                  fontSize="$2"
                  textDecorationLine="none"
                  hoverStyle={{ color: '$color12', textDecorationLine: 'none' }}
                  cursor="pointer"
                >
                  {item.label}
                </Text>
              </Link>
            ) : (
              <Text color="$color11" fontSize="$2">
                {item.label}
              </Text>
            )}
          </XStack>
        ))}
      </XStack>
      <YStack height={1} backgroundColor="$borderColor" />
    </YStack>
  )
}
