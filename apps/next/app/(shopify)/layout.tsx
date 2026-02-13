import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WearOn Ai — Shopify Admin',
}

export default function ShopifyRootLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''

  // Inline script checks for shop/host params before loading App Bridge.
  // This prevents the "missing required configuration fields: shop" console error
  // when the page is accessed directly outside the Shopify admin iframe.
  const bootstrapScript = `
    (function() {
      var params = new URLSearchParams(window.location.search);
      if (params.has('shop') || params.has('host')) {
        var s = document.createElement('script');
        s.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${apiKey}';
        s.dataset.apiKey = '${apiKey}';
        document.head.appendChild(s);
      }
    })();
  `

  return (
    <html lang="en">
      <head>
        {apiKey && (
          <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        )}
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
