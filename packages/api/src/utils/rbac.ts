import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logger'

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

/**
 * Check if a user has a specific permission
 */
export async function checkPermission(
  supabase: SupabaseClient,
  userId: string,
  permission: PermissionName
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_permission', {
    p_user_id: userId,
    p_permission_name: permission,
  })

  if (error) {
    logger.error('Error checking permission:', error)
    return false
  }

  return data === true
}

/**
 * Check if a user has a specific role
 */
export async function checkRole(
  supabase: SupabaseClient,
  userId: string,
  role: RoleName
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_role', {
    p_user_id: userId,
    p_role_name: role,
  })

  if (error) {
    logger.error('Error checking role:', error)
    return false
  }

  return data === true
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<PermissionName[]> {
  const { data, error } = await supabase.rpc('get_user_permissions', {
    p_user_id: userId,
  })

  if (error) {
    logger.error('Error getting user permissions:', error)
    return []
  }

  return (data || []).map((row: { permission_name: string }) => row.permission_name as PermissionName)
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleName[]> {
  const { data, error } = await supabase.rpc('get_user_roles', {
    p_user_id: userId,
  })

  if (error) {
    logger.error('Error getting user roles:', error)
    return []
  }

  return (data || []).map((row: { role_name: string }) => row.role_name as RoleName)
}

/**
 * Assign a role to a user
 */
export async function assignRole(
  supabase: SupabaseClient,
  userId: string,
  roleName: RoleName,
  assignedBy?: string
): Promise<boolean> {
  // Get role ID
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single()

  if (roleError || !role) {
    logger.error('Error finding role:', roleError)
    return false
  }

  // Assign role
  const { error } = await supabase.from('user_roles').insert({
    user_id: userId,
    role_id: role.id,
    assigned_by: assignedBy,
  })

  if (error) {
    logger.error('Error assigning role:', error)
    return false
  }

  return true
}

/**
 * Remove a role from a user
 */
export async function removeRole(
  supabase: SupabaseClient,
  userId: string,
  roleName: RoleName
): Promise<boolean> {
  // Get role ID
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single()

  if (roleError || !role) {
    logger.error('Error finding role:', roleError)
    return false
  }

  // Remove role
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', role.id)

  if (error) {
    logger.error('Error removing role:', error)
    return false
  }

  return true
}

/**
 * Check if user is admin
 */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return checkRole(supabase, userId, 'admin')
}

/**
 * Check if user is moderator or admin
 */
export async function isModerator(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const roles = await getUserRoles(supabase, userId)
  return roles.includes('moderator') || roles.includes('admin')
}
