'use client'

import { YStack, XStack, H2, Paragraph, Button } from '@my/ui'
import { Check } from '@tamagui/lucide-icons'
import { useLink } from 'solito/navigation'

export function LandingMerchants() {
  const onboardingLink = useLink({ href: '/merchant/onboarding' })
  const benefits = [
    'Reduce returns by up to 30%',
    'Increase conversion with visual confidence',
    'No technical setup - auto-installs on product pages',
    'Choose absorb mode (free for shoppers) or resell mode (new revenue)',
  ]

  return (
    <YStack
      paddingVertical="$16"
      paddingHorizontal="$6"
      backgroundColor="$color3"
      $gtSm={{
        paddingVertical: '$20',
        paddingHorizontal: '$10',
      }}
    >
      <XStack
        width="100%"
        maxWidth={1200}
        marginHorizontal="auto"
        gap="$10"
        flexWrap="wrap"
        alignItems="center"
      >
        {/* Content */}
        <YStack
          gap="$6"
          flex={1}
          minWidth={300}
        >
          <H2
            fontSize={36}
            fontWeight="700"
            color="$color12"
            $gtSm={{
              fontSize: 48,
            }}
          >
            Add Virtual Try-On to Your Shopify Store in 4 Minutes
          </H2>

          {/* Benefits */}
          <YStack gap="$3">
            {benefits.map((benefit, index) => (
              <XStack
                key={index}
                gap="$3"
                alignItems="center"
              >
                <Check
                  size={24}
                  color="$green10"
                  strokeWidth={3}
                />
                <Paragraph
                  fontSize="$5"
                  lineHeight={1.6}
                  color="$color11"
                >
                  {benefit}
                </Paragraph>
              </XStack>
            ))}
          </YStack>

          {/* CTA */}
          <Button
            {...onboardingLink}
            size="$5"
            backgroundColor="$blue10"
            color="white"
            fontSize="$5"
            paddingHorizontal="$8"
            borderRadius="$4"
            pressStyle={{ backgroundColor: '$blue11' }}
            alignSelf="flex-start"
            marginTop="$4"
          >
            Install on Shopify
          </Button>
        </YStack>

        {/* Visual Placeholder */}
        <YStack
          flex={1}
          minWidth={300}
          height={400}
          backgroundColor="$color5"
          borderRadius="$4"
          justifyContent="center"
          alignItems="center"
          borderWidth={2}
          borderColor="$color7"
          borderStyle="dashed"
        >
          <Paragraph
            color="$color9"
            fontSize="$5"
            textAlign="center"
            paddingHorizontal="$4"
          >
            Shopify Dashboard Screenshot
            {'\n'}
            (Widget preview goes here)
          </Paragraph>
        </YStack>
      </XStack>
    </YStack>
  )
}
