'use client'

import { Card, Text, YStack } from '@my/ui'
import {
  getSizeRecommendationPresentation,
  type SizeRecommendationInput,
} from './size-recommendation-presentation'

export function SizeRecommendationDisplay(props: SizeRecommendationInput) {
  const presentation = getSizeRecommendationPresentation(props)

  return (
    <Card
      padding="$4"
      bordered
    >
      <YStack gap="$2">
        <Text
          fontSize="$6"
          fontWeight="700"
          color="$color12"
        >
          {presentation.primaryText}
        </Text>

        {presentation.secondaryText ? (
          <Text
            fontSize="$4"
            color="$color11"
          >
            {presentation.secondaryText}
          </Text>
        ) : null}

        <Text
          fontSize="$3"
          color="$color10"
        >
          {presentation.disclaimer}
        </Text>
      </YStack>
    </Card>
  )
}
