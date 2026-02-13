'use client'

import { YStack, XStack, H1, Paragraph, Button } from '@my/ui'
import { useLink } from 'solito/navigation'

export function LandingHero() {
  const signupLink = useLink({ href: '/signup' })
  const merchantLink = useLink({ href: '/merchant/onboarding' })

  return (
    <YStack
      minHeight="100vh"
      paddingVertical="$10"
      paddingHorizontal="$6"
      justifyContent="center"
      alignItems="center"
      gap="$8"
      backgroundColor="$background"
      $gtSm={{
        paddingVertical: '$16',
        paddingHorizontal: '$10',
      }}
    >
      {/* Headline */}
      <YStack
        gap="$4"
        alignItems="center"
        maxWidth={900}
      >
        <H1
          fontSize={48}
          fontWeight="800"
          lineHeight={1.1}
          textAlign="center"
          color="$color12"
          $gtSm={{
            fontSize: 72,
          }}
        >
          See Yourself in Any Outfit, Instantly
        </H1>

        <Paragraph
          fontSize={20}
          lineHeight={1.5}
          color="$color10"
          textAlign="center"
          maxWidth={600}
          $gtSm={{
            fontSize: 24,
          }}
        >
          AI-powered virtual try-on and size recommendations in seconds
        </Paragraph>
      </YStack>

      {/* Visual Proof Placeholder */}
      <YStack
        width="100%"
        maxWidth={800}
        height={400}
        backgroundColor="#f0f1f3"
        borderRadius="$4"
        justifyContent="center"
        alignItems="center"
        borderWidth={2}
        borderColor="$color6"
        borderStyle="dashed"
        position="relative"
        zIndex={1}
        $gtSm={{
          height: 500,
        }}
      >
        <Paragraph
          color="$color8"
          fontSize="$5"
          textAlign="center"
        >
          Before/After Comparison
          {'\n'}
          (Visual proof goes here)
        </Paragraph>
      </YStack>

      {/* Dual CTAs */}
      <XStack
        gap="$4"
        width="100%"
        maxWidth={600}
        justifyContent="center"
        flexWrap="wrap"
      >
        <Button
          {...signupLink}
          size="$6"
          backgroundColor="$blue10"
          color="white"
          fontSize="$6"
          paddingHorizontal="$8"
          borderRadius="$4"
          pressStyle={{ backgroundColor: '$blue11' }}
          flexGrow={1}
          minWidth={200}
        >
          Try the App
        </Button>

        <Button
          {...merchantLink}
          size="$6"
          variant="outlined"
          borderColor="$blue10"
          color="$blue10"
          fontSize="$6"
          paddingHorizontal="$8"
          borderRadius="$4"
          pressStyle={{ borderColor: '$blue11', color: '$blue11' }}
          flexGrow={1}
          minWidth={200}
        >
          For Store Owners
        </Button>
      </XStack>

      {/* Trust Badge */}
      <Paragraph
        fontSize="$3"
        color="$color9"
        textAlign="center"
        $gtSm={{
          fontSize: '$4',
        }}
      >
        🔒 Your photos delete in 6 hours • Powered by OpenAI
      </Paragraph>
    </YStack>
  )
}
