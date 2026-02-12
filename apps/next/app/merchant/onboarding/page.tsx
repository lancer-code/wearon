'use client'

import { Suspense } from 'react'
import { MerchantOnboarding } from 'app/features/merchant'

export default function OnboardingPage() {
  return (
    <Suspense>
      <MerchantOnboarding />
    </Suspense>
  )
}
