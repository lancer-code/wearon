import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Script from 'next/script'
import PolarisProvider from './polaris-provider'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
}

export default function ShopifyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        data-api-key={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY}
      />
      <PolarisProvider>{children}</PolarisProvider>
    </>
  )
}
