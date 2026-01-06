import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from 'api'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const handler = async (req: NextRequest) => {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Extract authorization header (contains Supabase session token)
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })

  // Get current user from session
  const {
    data: { user },
  } = await supabase.auth.getUser(token)

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () =>
      Promise.resolve({
        supabase,
        user: user
          ? {
              id: user.id,
              email: user.email,
            }
          : null,
      }),
    onError({ error, path }) {
      console.error(`tRPC Error on path '${path}':`, error)
    },
  })
}

export { handler as GET, handler as POST }
