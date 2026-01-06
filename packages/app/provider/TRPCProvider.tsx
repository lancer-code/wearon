'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import superjson from 'superjson'
import { trpc } from '../utils/trpc'
import { useSupabase } from './SupabaseProvider'
import Constants from 'expo-constants'

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return ''
  }

  // For native apps, use the environment variable or localhost
  if (Constants.expoConfig) {
    const apiUrl = Constants.expoConfig.extra?.EXPO_PUBLIC_API_URL
    if (apiUrl) return apiUrl.replace('/api/trpc', '')
  }

  // Fallback for web
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSupabase()

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000, // 5 seconds
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers: async () => {
            const headers: Record<string, string> = {}

            // Attach Supabase session token to requests
            if (session?.access_token) {
              headers.authorization = `Bearer ${session.access_token}`
            }

            return headers
          },
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
