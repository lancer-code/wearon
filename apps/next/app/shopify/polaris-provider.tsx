'use client'

import { AppProvider } from '@shopify/polaris'
import enTranslations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import { type ReactNode, useEffect, useState } from 'react'

function AppBridgeGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Check if shopify global is already available (script loaded synchronously)
    if (typeof window !== 'undefined' && (window as any).shopify) {
      setReady(true)
      return
    }

    // Poll briefly in case of slight delay
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).shopify) {
        setReady(true)
        clearInterval(interval)
      }
    }, 50)

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval)
      setReady(true) // render anyway so pages can show their own error
    }, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  if (!ready) {
    return null
  }

  return <>{children}</>
}

export default function PolarisProvider({ children }: { children: ReactNode }) {
  return (
    <AppProvider i18n={enTranslations}>
      <AppBridgeGate>{children}</AppBridgeGate>
    </AppProvider>
  )
}
