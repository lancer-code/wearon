'use client'

import { useParams } from 'next/navigation'
import { AdminStoreDetail } from 'app/features/admin/admin-store-detail'

export default function AdminStoreDetailPage() {
  const params = useParams<{ id: string }>()

  return <AdminStoreDetail storeId={params.id} />
}
