'use client'

import { YStack, XStack, H2, Paragraph, Card, Button } from '@my/ui'
import { Upload, Ruler, Sparkles } from '@tamagui/lucide-icons'
import { useLink } from 'solito/navigation'

export function LandingHowItWorks() {
  const signupLink = useLink({ href: '/signup' })

  const steps = [
    {
      number: 1,
      icon: Upload,
      title: 'Upload Photo',
      description: 'Upload a full-body photo of yourself',
    },
    {
      number: 2,
      icon: Ruler,
      title: 'Get Recommendations',
      description: 'Instant size recommendation from AI pose detection',
    },
    {
      number: 3,
      icon: Sparkles,
      title: 'See Yourself',
      description: 'View yourself wearing the outfit in seconds',
    },
  ]

  return (
    <YStack
      paddingVertical="$16"
      paddingHorizontal="$6"
      backgroundColor="$color2"
      alignItems="center"
      $gtSm={{
        paddingVertical: '$20',
        paddingHorizontal: '$10',
      }}
    >
      <YStack
        gap="$10"
        width="100%"
        maxWidth={1200}
        alignItems="center"
      >
        {/* Heading */}
        <H2
          fontSize={36}
          fontWeight="700"
          textAlign="center"
          color="$color12"
          $gtSm={{
            fontSize: 48,
          }}
        >
          Three Steps to Your Perfect Fit
        </H2>

        {/* Steps Grid */}
        <XStack
          gap="$6"
          width="100%"
          flexWrap="wrap"
          justifyContent="center"
        >
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <Card
                key={step.number}
                padding="$6"
                width="100%"
                maxWidth={350}
                backgroundColor="$background"
                borderRadius="$4"
                elevate
                $gtSm={{
                  flexBasis: '30%',
                }}
              >
                <YStack
                  gap="$4"
                  alignItems="center"
                >
                  {/* Number Badge */}
                  <YStack
                    width={48}
                    height={48}
                    borderRadius="$10"
                    backgroundColor="$blue10"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Paragraph
                      fontSize="$7"
                      fontWeight="700"
                      color="white"
                    >
                      {step.number}
                    </Paragraph>
                  </YStack>

                  {/* Icon */}
                  <Icon
                    size={64}
                    color="$blue10"
                  />

                  {/* Title */}
                  <Paragraph
                    fontSize="$6"
                    fontWeight="600"
                    textAlign="center"
                    color="$color12"
                  >
                    {step.title}
                  </Paragraph>

                  {/* Description */}
                  <Paragraph
                    fontSize="$4"
                    lineHeight={1.6}
                    textAlign="center"
                    color="$color10"
                  >
                    {step.description}
                  </Paragraph>
                </YStack>
              </Card>
            )
          })}
        </XStack>

        {/* CTA */}
        <Button
          {...signupLink}
          size="$5"
          backgroundColor="$blue10"
          color="white"
          fontSize="$5"
          paddingHorizontal="$8"
          borderRadius="$4"
          pressStyle={{ backgroundColor: '$blue11' }}
          marginTop="$6"
        >
          Start Trying On
        </Button>
      </YStack>
    </YStack>
  )
}
