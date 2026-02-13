import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import PolarisProvider from './polaris-provider'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
}

export default function ShopifyLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''

  return (
    <>
      {/* App Bridge v4 must load synchronously before React hydration */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
        data-api-key={apiKey}
      />
      <PolarisProvider>{children}</PolarisProvider>
    </>
  )
}
