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
        .admin-content ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .admin-content ::-webkit-scrollbar-track {
          background: transparent;
        }
        .admin-content ::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 3px;
        }
        .admin-content ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
        .admin-content {
          scrollbar-width: thin;
          scrollbar-color: #3f3f46 transparent;
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
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: '#0a0a0b',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Breadcrumb - sticky at top */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#0a0a0b' }}>
              <Breadcrumb items={breadcrumbs} />
            </div>
          )}

          {/* Page Content */}
          <div
            className="admin-content"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
