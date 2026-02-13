'use client'

import { YStack, XStack, H2, Paragraph, Card } from '@my/ui'
import { Clock, Shield, CheckCircle, Cpu } from '@tamagui/lucide-icons'

export function LandingPrivacy() {
  const trustPoints = [
    {
      icon: Clock,
      title: '6-Hour Auto-Delete',
      description: 'Photos automatically deleted after processing',
    },
    {
      icon: Shield,
      title: 'No Permanent Storage',
      description: "We don't keep your images, period",
    },
    {
      icon: CheckCircle,
      title: 'COPPA Compliant',
      description: 'Safe for ages 13+ with proper safeguards',
    },
    {
      icon: Cpu,
      title: 'AI Transparency',
      description: 'Powered by OpenAI GPT Image & MediaPipe',
    },
  ]

  return (
    <YStack
      paddingVertical="$16"
      paddingHorizontal="$6"
      backgroundColor="$background"
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
          Your Privacy, Our Priority
        </H2>

        {/* Trust Points Grid */}
        <XStack
          gap="$6"
          width="100%"
          flexWrap="wrap"
          justifyContent="center"
        >
          {trustPoints.map((point, index) => {
            const Icon = point.icon
            return (
              <Card
                key={index}
                padding="$6"
                width="100%"
                maxWidth={360}
                backgroundColor="$color2"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$color5"
                $gtSm={{
                  flexBasis: '22%',
                  minWidth: 240,
                }}
              >
                <YStack
                  gap="$3"
                  alignItems="center"
                >
                  {/* Icon */}
                  <Icon
                    size={48}
                    color="$blue9"
                    strokeWidth={1.5}
                  />

                  {/* Title */}
                  <Paragraph
                    fontSize="$5"
                    fontWeight="600"
                    textAlign="center"
                    color="$color12"
                  >
                    {point.title}
                  </Paragraph>

                  {/* Description */}
                  <Paragraph
                    fontSize="$3"
                    lineHeight={1.5}
                    textAlign="center"
                    color="$color10"
                  >
                    {point.description}
                  </Paragraph>
                </YStack>
              </Card>
            )
          })}
        </XStack>
      </YStack>
    </YStack>
  )
}
