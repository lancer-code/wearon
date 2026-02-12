'use client'

import { Home, Key, CreditCard, Settings, LogOut } from '@tamagui/lucide-icons'
import { useRouter } from 'solito/navigation'
import { useSupabase } from '../../provider/SupabaseProvider'
import { supabase } from '../../utils/supabase'

interface SidebarItemProps {
  icon: React.ElementType
  label: string
  href: string
  active?: boolean
}

function SidebarItem({ icon: Icon, label, href, active }: SidebarItemProps) {
  const router = useRouter()

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

interface MerchantSidebarProps {
  activePath?: string
}

export function MerchantSidebar({ activePath = '/merchant/dashboard' }: MerchantSidebarProps) {
  const { user } = useSupabase()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/merchant/dashboard' },
    { icon: Key, label: 'API Keys', href: '/merchant/api-keys' },
    { icon: CreditCard, label: 'Billing', href: '/merchant/billing' },
    { icon: Settings, label: 'Settings', href: '/merchant/settings' },
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
          Merchant Portal
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
            active={activePath === item.href}
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
          type="button"
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
