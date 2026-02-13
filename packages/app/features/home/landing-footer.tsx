'use client'

import { YStack, XStack, Paragraph, Anchor } from '@my/ui'
import { useLink } from 'solito/navigation'

export function LandingFooter() {
  const loginLink = useLink({ href: '/login' })
  const signupLink = useLink({ href: '/signup' })

  const footerSections = [
    {
      title: 'Product',
      links: [
        { label: 'Consumer App', href: '/signup' },
        { label: 'Shopify Plugin', href: '/merchant/onboarding' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ],
    },
  ]

  return (
    <YStack
      paddingVertical="$10"
      paddingHorizontal="$6"
      backgroundColor="$color1"
      borderTopWidth={1}
      borderTopColor="$color5"
      $gtSm={{
        paddingVertical: '$12',
        paddingHorizontal: '$10',
      }}
    >
      <YStack gap="$8" width="100%" maxWidth={1200} marginHorizontal="auto">
        {/* Footer Grid */}
        <XStack
          gap="$8"
          flexWrap="wrap"
          justifyContent="space-between"
        >
          {footerSections.map((section) => (
            <YStack key={section.title} gap="$3" minWidth={150}>
              <Paragraph fontSize="$5" fontWeight="600" color="$color12">
                {section.title}
              </Paragraph>
              {section.links.map((link) => (
                <Anchor
                  key={link.label}
                  href={link.href}
                  fontSize="$4"
                  color="$color10"
                  textDecorationLine="none"
                  hoverStyle={{ color: '$blue10' }}
                >
                  {link.label}
                </Anchor>
              ))}
            </YStack>
          ))}

          {/* Auth Links */}
          <YStack gap="$3" minWidth={150}>
            <Paragraph fontSize="$5" fontWeight="600" color="$color12">
              Account
            </Paragraph>
            <Anchor
              {...loginLink}
              fontSize="$4"
              color="$color10"
              textDecorationLine="none"
              hoverStyle={{ color: '$blue10' }}
            >
              Login
            </Anchor>
            <Anchor
              {...signupLink}
              fontSize="$4"
              color="$color10"
              textDecorationLine="none"
              hoverStyle={{ color: '$blue10' }}
            >
              Sign Up
            </Anchor>
          </YStack>
        </XStack>

        {/* Copyright */}
        <XStack
          paddingTop="$6"
          borderTopWidth={1}
          borderTopColor="$color5"
          justifyContent="space-between"
          flexWrap="wrap"
          gap="$4"
        >
          <Paragraph fontSize="$3" color="$color9">
            © 2026 WearOn. All rights reserved.
          </Paragraph>
          <Paragraph fontSize="$3" color="$color9">
            Powered by OpenAI GPT Image & MediaPipe
          </Paragraph>
        </XStack>
      </YStack>
    </YStack>
  )
}
