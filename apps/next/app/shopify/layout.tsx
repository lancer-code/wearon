import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import PolarisProvider from './polaris-provider'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
  other: {
    'shopify-api-key': process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID || '',
  },
}

export default function ShopifyLayout({ children }: { children: ReactNode }) {
  return <PolarisProvider>{children}</PolarisProvider>
}
