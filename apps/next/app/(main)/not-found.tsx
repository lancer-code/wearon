'use client'

import { YStack, H1, Text, Button } from '@my/ui'
import Link from 'next/link'

export default function NotFound() {
  return (
    <YStack
      flex={1}
      items="center"
      justify="center"
      padding="$6"
      gap="$4"
    >
      <H1>404</H1>
      <Text
        color="$gray11"
        textAlign="center"
      >
        Page not found
      </Text>
      <Link href="/">
        <Button>Go Home</Button>
      </Link>
    </YStack>
  )
}
