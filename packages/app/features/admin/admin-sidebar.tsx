'use client'

import { Home, Users, BarChart3, Image, CreditCard, Settings, LogOut, Store, Activity, UserCircle, DollarSign } from '@tamagui/lucide-icons'
import { useRouter } from 'solito/navigation'
import { useSupabase } from '../../provider/SupabaseProvider'
import { supabase } from '../../utils/supabase'

interface SidebarItemProps {
  icon: React.ElementType
  label: string
  href: string
  active?: boolean
  adminOnly?: boolean
}

function SidebarItem({ icon: Icon, label, href, active, adminOnly }: SidebarItemProps) {
  const { isAdmin } = useSupabase()
  const router = useRouter()

  if (adminOnly && !isAdmin) {
    return null
  }

  return (
    <div
      onClick={() => router.push(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        backgroundColor: active ? '#27272a' : 'transparent',
        color: active ? '#fafafa' : '#a1a1aa',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = '#1f1f23'
          e.currentTarget.style.color = '#fafafa'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#a1a1aa'
        }
      }}
    >
      <Icon size={18} color={active ? '#fafafa' : '#a1a1aa'} />
      <span style={{ fontSize: 14, fontWeight: active ? 500 : 400 }}>{label}</span>
    </div>
  )
}

interface AdminSidebarProps {
  activePath?: string
}

export function AdminSidebar({ activePath = '/admin' }: AdminSidebarProps) {
  const { user } = useSupabase()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/admin', adminOnly: false },
    { icon: Users, label: 'Users', href: '/admin/users', adminOnly: true },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics', adminOnly: false },
    { icon: Activity, label: 'B2B Analytics', href: '/admin/b2b-analytics', adminOnly: true },
    { icon: UserCircle, label: 'B2C Analytics', href: '/admin/b2c-analytics', adminOnly: true },
    { icon: DollarSign, label: 'Revenue', href: '/admin/revenue', adminOnly: true },
    { icon: Store, label: 'Stores', href: '/admin/stores', adminOnly: true },
    { icon: Image, label: 'Generations', href: '/admin/generations', adminOnly: false },
    { icon: CreditCard, label: 'Credits', href: '/admin/credits', adminOnly: true },
    { icon: Settings, label: 'Settings', href: '/admin/settings', adminOnly: false },
  ]

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#09090b',
        borderRight: '1px solid #27272a',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 20,
          borderBottom: '1px solid #27272a',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#fafafa',
          }}
        >
          Admin Panel
        </span>
      </div>

      {/* Navigation Items */}
      <div
        style={{
          flex: 1,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {navItems.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={activePath === item.href || (item.href !== '/admin' && activePath?.startsWith(item.href))}
            adminOnly={item.adminOnly}
          />
        ))}
      </div>

      {/* Footer - User info */}
      <div
        style={{
          padding: 16,
          borderTop: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: '#71717a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user?.email}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #27272a',
            backgroundColor: 'transparent',
            color: '#a1a1aa',
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#27272a'
            e.currentTarget.style.color = '#fafafa'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#a1a1aa'
          }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
