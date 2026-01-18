'use client'

import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

export interface PageContentProps {
  children: ReactNode
}

export function PageContent({ children }: PageContentProps) {
  return (
    <YStack flex={1} flexGrow={1} minHeight={0} gap="$4">
      {children}
    </YStack>
  )
}
