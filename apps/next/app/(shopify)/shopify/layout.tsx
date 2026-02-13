import type { ReactNode } from 'react'
import PolarisProvider from './polaris-provider'

export default function ShopifyLayout({ children }: { children: ReactNode }) {
  return <PolarisProvider>{children}</PolarisProvider>
}
