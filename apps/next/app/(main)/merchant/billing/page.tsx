'use client'

import { Suspense } from 'react'
import { MerchantBilling } from 'app/features/merchant'

export default function BillingPage() {
  return (
    <Suspense>
      <MerchantBilling />
    </Suspense>
  )
}
