import { initTRPC, TRPCError } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import superjson from 'superjson'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Context {
  supabase: SupabaseClient
  user: {
    id: string
    email?: string
  } | null
}

export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  // This will be populated by the Next.js API route handler with Supabase client
  return {
    supabase: null as any, // Will be set by API route
    user: null,
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts

  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    })
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})
