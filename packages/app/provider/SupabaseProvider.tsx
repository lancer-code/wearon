'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'
import { Platform } from 'react-native'

export type RoleName = 'user' | 'moderator' | 'admin'
export type PermissionName =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:manage'
  | 'generations:read'
  | 'generations:create'
  | 'generations:delete'
  | 'generations:manage'
  | 'credits:read'
  | 'credits:grant'
  | 'credits:manage'
  | 'analytics:read'
  | 'admin:access'
  | 'roles:manage'

interface SupabaseContext {
  user: User | null
  session: Session | null
  loading: boolean
  roles: RoleName[]
  permissions: PermissionName[]
  hasRole: (role: RoleName) => boolean
  hasPermission: (permission: PermissionName) => boolean
  isAdmin: boolean
  isModerator: boolean
  refreshRoles: () => Promise<void>
}

const SupabaseContext = createContext<SupabaseContext>({
  user: null,
  session: null,
  loading: true,
  roles: [],
  permissions: [],
  hasRole: () => false,
  hasPermission: () => false,
  isAdmin: false,
  isModerator: false,
  refreshRoles: async () => {},
})

export const useSupabase = () => useContext(SupabaseContext)

// Auth routes that should redirect to dashboard when authenticated
const AUTH_ROUTES = ['/login', '/signup']
// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/admin']

function handleAuthRedirect(event: AuthChangeEvent, session: Session | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return

  const currentPath = window.location.pathname

  if (event === 'SIGNED_IN' && session) {
    // Redirect to dashboard if on auth pages
    if (AUTH_ROUTES.some((route) => currentPath.startsWith(route))) {
      window.location.href = '/dashboard'
    }
  } else if (event === 'SIGNED_OUT') {
    // Redirect to login if on protected pages
    if (PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
      window.location.href = '/login'
    }
  }
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleName[]>([])
  const [permissions, setPermissions] = useState<PermissionName[]>([])

  const fetchUserRolesAndPermissions = useCallback(async (userId: string) => {
    try {
      // Fetch roles
      const { data: rolesData } = await supabase.rpc('get_user_roles', {
        p_user_id: userId,
      })
      const userRoles = (rolesData || []).map(
        (r: { role_name: string }) => r.role_name as RoleName
      )
      setRoles(userRoles)

      // Fetch permissions
      const { data: permissionsData } = await supabase.rpc('get_user_permissions', {
        p_user_id: userId,
      })
      const userPermissions = (permissionsData || []).map(
        (p: { permission_name: string }) => p.permission_name as PermissionName
      )
      setPermissions(userPermissions)
    } catch (error) {
      console.error('Error fetching roles/permissions:', error)
      setRoles([])
      setPermissions([])
    }
  }, [])

  const refreshRoles = useCallback(async () => {
    if (user?.id) {
      await fetchUserRolesAndPermissions(user.id)
    }
  }, [user?.id, fetchUserRolesAndPermissions])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRolesAndPermissions(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        fetchUserRolesAndPermissions(session.user.id)
      } else {
        setRoles([])
        setPermissions([])
      }

      setLoading(false)

      // Handle redirects based on auth state
      handleAuthRedirect(event, session)
    })

    return () => subscription.unsubscribe()
  }, [fetchUserRolesAndPermissions])

  const hasRole = useCallback((role: RoleName) => roles.includes(role), [roles])
  const hasPermission = useCallback(
    (permission: PermissionName) => permissions.includes(permission),
    [permissions]
  )
  const isAdmin = roles.includes('admin')
  const isModerator = roles.includes('moderator') || roles.includes('admin')

  return (
    <SupabaseContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        permissions,
        hasRole,
        hasPermission,
        isAdmin,
        isModerator,
        refreshRoles,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  )
}
