'use client'

import { AppProvider } from '@shopify/polaris'
import enTranslations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import { type ReactNode, useEffect, useState } from 'react'

function ShopifyGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'not-embedded'>('loading')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasShop = params.has('shop') || params.has('host')

    if (!hasShop) {
      setState('not-embedded')
      return
    }

    // App Bridge script loaded in <head> — check if shopify global exists
    if ((window as any).shopify) {
      setState('ready')
      return
    }

    // Brief poll in case script is still initializing
    const interval = setInterval(() => {
      if ((window as any).shopify) {
        setState('ready')
        clearInterval(interval)
      }
    }, 50)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setState('not-embedded')
    }, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  if (state === 'loading') {
    return null
  }

  if (state === 'not-embedded') {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center' }}>
        <h1>WearOn Ai</h1>
        <p style={{ color: '#666', maxWidth: 400, margin: '16px auto' }}>
          This page must be accessed from within the Shopify admin.
          Open your Shopify admin and click on the WearOn Ai app.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

export default function PolarisProvider({ children }: { children: ReactNode }) {
  return (
    <AppProvider i18n={enTranslations}>
      <ShopifyGate>{children}</ShopifyGate>
    </AppProvider>
  )
}
