'use client'

import { XStack, Paragraph, Anchor } from '@my/ui'
import { useLink } from 'solito/navigation'

export function LandingNav() {
  const loginLink = useLink({ href: '/login' })
  const signupLink = useLink({ href: '/signup' })

  return (
    <XStack
      paddingVertical="$3"
      paddingHorizontal="$6"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor="$background"
      borderBottomWidth={1}
      borderBottomColor="$color5"
      $gtSm={{
        paddingHorizontal: '$10',
      }}
    >
      {/* Logo */}
      <Paragraph
        fontSize="$6"
        fontWeight="700"
        color="$color12"
      >
        WearOn
      </Paragraph>

      {/* Auth Links */}
      <XStack
        gap="$4"
        alignItems="center"
      >
        <Anchor
          {...loginLink}
          fontSize="$4"
          color="$color11"
          textDecorationLine="none"
          hoverStyle={{ color: '$blue10' }}
        >
          Login
        </Anchor>
        <Anchor
          {...signupLink}
          fontSize="$4"
          color="$blue10"
          fontWeight="600"
          textDecorationLine="none"
          hoverStyle={{ color: '$blue11' }}
        >
          Sign Up
        </Anchor>
      </XStack>
    </XStack>
  )
}
