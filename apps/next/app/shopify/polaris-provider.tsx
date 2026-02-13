'use client'

import { AppProvider } from '@shopify/polaris'
import enTranslations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import { type ReactNode, useEffect, useState } from 'react'

function AppBridgeReady({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    if ((window as any).shopify) {
      setStatus('ready')
      return
    }

    const interval = setInterval(() => {
      if ((window as any).shopify) {
        setStatus('ready')
        clearInterval(interval)
      }
    }, 50)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!(window as any).shopify) {
        setStatus('failed')
      }
    }, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  if (status === 'loading') return null
  if (status === 'failed') {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>Unable to connect to Shopify</h2>
        <p>This page must be loaded from within the Shopify admin.</p>
      </div>
    )
  }
  return <>{children}</>
}

export default function PolarisProvider({ children }: { children: ReactNode }) {
  return (
    <AppProvider i18n={enTranslations}>
      <AppBridgeReady>{children}</AppBridgeReady>
    </AppProvider>
  )
}
