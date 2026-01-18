'use client'

import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

export interface PageFooterProps {
  children: ReactNode
}

export function PageFooter({ children }: PageFooterProps) {
  return (
    <YStack paddingTop="$4" marginTop="auto" flexShrink={0}>
      {children}
    </YStack>
  )
}
