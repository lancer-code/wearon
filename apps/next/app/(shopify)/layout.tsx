import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
}

export default function ShopifyRootLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''

  return (
    <html lang="en">
      <head>
        {/* App Bridge v4 MUST be the first script in the document */}
        <script
          src={`https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}`}
          data-api-key={apiKey}
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
