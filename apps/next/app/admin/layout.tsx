'use client'

import { usePathname } from 'next/navigation'
import { AdminLayout } from 'app/features/admin'

export default function AdminLayoutPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return <AdminLayout activePath={pathname}>{children}</AdminLayout>
}
