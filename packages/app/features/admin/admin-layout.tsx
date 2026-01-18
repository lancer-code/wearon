'use client'

import { AdminSidebar } from './admin-sidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  activePath?: string
}

export function AdminLayout({ children, activePath }: AdminLayoutProps) {
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
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
