'use client'

import type { ReactNode } from 'react'
import { YStack } from 'tamagui'

export interface PageFooterProps {
  children: ReactNode
}

export function PageFooter({ children }: PageFooterProps) {
  return (
    <YStack
      paddingVertical="$2"
      flexShrink={0}
      borderTopWidth={1}
      borderTopColor="$borderColor"
      backgroundColor="$background"
    >
      {children}
    </YStack>
  )
}
