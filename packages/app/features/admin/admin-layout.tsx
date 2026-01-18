'use client'

import { Breadcrumb } from '@my/ui'
import type { BreadcrumbItem } from '@my/ui'
import { AdminSidebar } from './admin-sidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  activePath?: string
  breadcrumbs?: BreadcrumbItem[]
}

export function AdminLayout({ children, activePath, breadcrumbs }: AdminLayoutProps) {
  return (
    <>
      <style>{`
        .admin-content::-webkit-scrollbar {
          display: none;
        }
        .admin-content {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100vh',
          minHeight: '100vh',
        }}
      >
        {/* Sidebar */}
        <AdminSidebar activePath={activePath} />

        {/* Content Area */}
        <div
          className="admin-content"
          style={{
            flex: 1,
            overflow: 'auto',
            minWidth: 0,
            backgroundColor: '#0a0a0b',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Breadcrumb - full width, outside content padding */}
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}

          {/* Page Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
