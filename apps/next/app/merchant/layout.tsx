'use client'

import { usePathname } from 'next/navigation'
import { MerchantLayout } from 'app/features/merchant'
import type { BreadcrumbItem } from '@my/ui'

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ''
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    const label = segment.charAt(0).toUpperCase() + segment.slice(1)
    const isLast = i === segments.length - 1

    breadcrumbs.push({
      label,
      href: isLast ? undefined : currentPath,
    })
  }

  return breadcrumbs
}

export default function MerchantLayoutPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const breadcrumbs = generateBreadcrumbs(pathname)

  return (
    <MerchantLayout activePath={pathname} breadcrumbs={breadcrumbs}>
      {children}
    </MerchantLayout>
  )
}
