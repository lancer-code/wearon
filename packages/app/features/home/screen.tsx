'use client'

import { YStack } from '@my/ui'
import { LandingHero } from './landing-hero'
import { LandingHowItWorks } from './landing-how-it-works'
import { LandingMerchants } from './landing-merchants'
import { LandingPrivacy } from './landing-privacy'
import { LandingFooter } from './landing-footer'

export function HomeScreen() {
  return (
    <YStack flex={1} backgroundColor="$background">
      <LandingHero />
      <LandingHowItWorks />
      <LandingMerchants />
      <LandingPrivacy />
      <LandingFooter />
    </YStack>
  )
}
