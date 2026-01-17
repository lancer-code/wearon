import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc'
import {
  getUserRoles,
  getUserPermissions,
  assignRole,
  removeRole,
  type RoleName,
} from '../utils/rbac'

export const rolesRouter = router({
  // Get current user's roles
  myRoles: protectedProcedure.query(async ({ ctx }) => {
    return getUserRoles(ctx.supabase, ctx.user.id)
  }),

  // Get current user's permissions
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    return getUserPermissions(ctx.supabase, ctx.user.id)
  }),

  // Get all available roles (public read)
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('roles')
      .select('id, name, description')
      .order('name')

    if (error) throw error
    return data
  }),

  // Get all available permissions (public read)
  listPermissions: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('permissions')
      .select('id, name, description, resource, action')
      .order('resource, action')

    if (error) throw error
    return data
  }),

  // Get roles for a specific user (admin only)
  getUserRoles: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getUserRoles(ctx.supabase, input.userId)
    }),

  // Get permissions for a specific user (admin only)
  getUserPermissions: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getUserPermissions(ctx.supabase, input.userId)
    }),

  // Assign role to user (admin only)
  assign: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['user', 'moderator', 'admin']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const success = await assignRole(
        ctx.supabase,
        input.userId,
        input.role as RoleName,
        ctx.user.id
      )

      if (!success) {
        throw new Error('Failed to assign role')
      }

      return { success: true }
    }),

  // Remove role from user (admin only)
  remove: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['user', 'moderator', 'admin']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent removing last admin
      if (input.role === 'admin') {
        const { count } = await ctx.supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', (
            await ctx.supabase
              .from('roles')
              .select('id')
              .eq('name', 'admin')
              .single()
          ).data?.id)

        if (count && count <= 1) {
          throw new Error('Cannot remove the last admin')
        }
      }

      const success = await removeRole(ctx.supabase, input.userId, input.role as RoleName)

      if (!success) {
        throw new Error('Failed to remove role')
      }

      return { success: true }
    }),

  // Get all users with their roles (admin only)
  listUsersWithRoles: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { data: users, error } = await ctx.supabase
        .from('users')
        .select(`
          id,
          email,
          display_name,
          created_at,
          user_roles (
            role:roles (
              name
            )
          )
        `)
        .range(input.offset, input.offset + input.limit - 1)
        .order('created_at', { ascending: false })

      if (error) throw error

      return users.map((user: any) => ({
        ...user,
        roles: user.user_roles?.map((ur: any) => ur.role?.name).filter(Boolean) || [],
      }))
    }),
})
