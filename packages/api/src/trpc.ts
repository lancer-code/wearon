import { initTRPC, TRPCError } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import superjson from 'superjson'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkPermission, checkRole } from './utils/rbac'
import type { PermissionName, RoleName } from './utils/rbac'

export interface Context {
  supabase: SupabaseClient
  adminSupabase: SupabaseClient // Service role client, bypasses RLS
  user: {
    id: string
    email?: string
  } | null
}

export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  // This will be populated by the Next.js API route handler with Supabase client
  return {
    supabase: null as any, // Will be set by API route
    adminSupabase: null as any, // Will be set by API route
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

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts

  const isAdmin = await checkRole(ctx.supabase, ctx.user.id, 'admin')

  if (!isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return opts.next({ ctx })
})

// Moderator procedure - requires moderator or admin role
export const moderatorProcedure = protectedProcedure.use(async (opts) => {
  const { ctx } = opts

  const [isMod, isAdmin] = await Promise.all([
    checkRole(ctx.supabase, ctx.user.id, 'moderator'),
    checkRole(ctx.supabase, ctx.user.id, 'admin'),
  ])

  if (!isMod && !isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return opts.next({ ctx })
})

// Permission-based procedure factory
export function withPermission(permission: PermissionName) {
  return protectedProcedure.use(async (opts) => {
    const { ctx } = opts

    const hasPermission = await checkPermission(ctx.supabase, ctx.user.id, permission)

    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have the required permission: ${permission}`,
      })
    }

    return opts.next({ ctx })
  })
}
