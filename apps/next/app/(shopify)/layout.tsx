import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
  other: {
    'shopify-api-key': process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID || '',
  },
}

export default function ShopifyRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
