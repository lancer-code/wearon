'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'
import { Platform } from 'react-native'

interface SupabaseContext {
  user: User | null
  session: Session | null
  loading: boolean
}

const SupabaseContext = createContext<SupabaseContext>({
  user: null,
  session: null,
  loading: true,
})

export const useSupabase = () => useContext(SupabaseContext)

// Auth routes that should redirect to dashboard when authenticated
const AUTH_ROUTES = ['/login', '/signup']
// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard']

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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Handle redirects based on auth state
      handleAuthRedirect(event, session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SupabaseContext.Provider value={{ user, session, loading }}>
      {children}
    </SupabaseContext.Provider>
  )
}
