# Role-Based Access Control (RBAC) Implementation

This document provides a comprehensive overview of the RBAC system implemented in the WearOn platform.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Default Roles & Permissions](#default-roles--permissions)
- [API Layer](#api-layer)
- [Client-Side Usage](#client-side-usage)
- [Route Protection](#route-protection)
- [Common Use Cases](#common-use-cases)
- [Adding New Roles/Permissions](#adding-new-rolespermissions)
- [Security Considerations](#security-considerations)

---

## Overview

The RBAC system provides granular access control through:

- **Roles**: Named groups (user, moderator, admin) that define access levels
- **Permissions**: Specific actions users can perform (e.g., `users:read`, `credits:manage`)
- **Role-Permission Mapping**: Assigns permissions to roles
- **User-Role Assignment**: Assigns roles to users

This design allows:
- Multiple roles per user
- Multiple permissions per role
- Easy addition of new roles/permissions without code changes
- Centralized permission checks at database level

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useSupabase() hook                                       │   │
│  │ - roles, permissions, hasRole(), hasPermission()         │   │
│  │ - isAdmin, isModerator                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Proxy (Server)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ proxy.ts                                                 │   │
│  │ - Protects /admin/* routes                               │   │
│  │ - Calls supabase.rpc('user_has_role')                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC API Layer                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Procedures:                                              │   │
│  │ - protectedProcedure (auth required)                     │   │
│  │ - adminProcedure (admin role required)                   │   │
│  │ - moderatorProcedure (moderator or admin)                │   │
│  │ - withPermission() (custom permission)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Tables: roles, permissions, role_permissions, user_roles │   │
│  │ Functions: user_has_permission(), user_has_role()        │   │
│  │ RLS Policies: Row-level security for all RBAC tables     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### `roles`
Stores available roles in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Unique role name (e.g., 'admin') |
| description | TEXT | Human-readable description |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `permissions`
Stores available permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Unique permission name (e.g., 'users:read') |
| description | TEXT | Human-readable description |
| resource | TEXT | Resource category (users, generations, credits, admin) |
| action | TEXT | Action type (read, write, delete, manage, access) |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `role_permissions`
Maps roles to their permissions (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| role_id | UUID | Foreign key to roles |
| permission_id | UUID | Foreign key to permissions |
| created_at | TIMESTAMPTZ | Assignment timestamp |

#### `user_roles`
Assigns roles to users (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | Foreign key to users |
| role_id | UUID | Foreign key to roles |
| assigned_at | TIMESTAMPTZ | Assignment timestamp |
| assigned_by | UUID | User who assigned the role (nullable) |

### Database Functions (RPC)

```sql
-- Check if user has a specific permission
user_has_permission(p_user_id UUID, p_permission_name TEXT) RETURNS BOOLEAN

-- Check if user has a specific role
user_has_role(p_user_id UUID, p_role_name TEXT) RETURNS BOOLEAN

-- Get all permissions for a user
get_user_permissions(p_user_id UUID) RETURNS TABLE (permission_name TEXT)

-- Get all roles for a user
get_user_roles(p_user_id UUID) RETURNS TABLE (role_name TEXT)
```

### Triggers

**`on_user_created_assign_role`**: Automatically assigns the `user` role when a new user is created in the `public.users` table.

### Row Level Security (RLS)

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|---------------------|
| roles | Anyone | Admins only (`roles:manage` permission) |
| permissions | Anyone | Admins only (`roles:manage` permission) |
| role_permissions | Anyone | Admins only (`roles:manage` permission) |
| user_roles | Own roles or admins | Admins only (`roles:manage` permission) |

---

## Default Roles & Permissions

### Roles

| Role | Description |
|------|-------------|
| **user** | Regular user with standard access |
| **moderator** | Moderator with limited admin access |
| **admin** | Administrator with full access |

### Permissions

| Permission | Resource | Action | Description |
|------------|----------|--------|-------------|
| users:read | users | read | View user profiles |
| users:write | users | write | Edit user profiles |
| users:delete | users | delete | Delete users |
| users:manage | users | manage | Full user management |
| generations:read | generations | read | View generations |
| generations:create | generations | create | Create generations |
| generations:delete | generations | delete | Delete generations |
| generations:manage | generations | manage | Full generation management |
| credits:read | credits | read | View credit balance |
| credits:grant | credits | grant | Grant credits to users |
| credits:manage | credits | manage | Full credit management |
| analytics:read | analytics | read | View analytics |
| admin:access | admin | access | Access admin panel |
| roles:manage | roles | manage | Manage user roles |

### Role-Permission Mapping

| Permission | user | moderator | admin |
|------------|:----:|:---------:|:-----:|
| generations:read | ✓ | ✓ | ✓ |
| generations:create | ✓ | ✓ | ✓ |
| credits:read | ✓ | ✓ | ✓ |
| users:read | | ✓ | ✓ |
| analytics:read | | ✓ | ✓ |
| generations:manage | | ✓ | ✓ |
| users:write | | | ✓ |
| users:delete | | | ✓ |
| users:manage | | | ✓ |
| generations:delete | | | ✓ |
| credits:grant | | | ✓ |
| credits:manage | | | ✓ |
| admin:access | | | ✓ |
| roles:manage | | | ✓ |

---

## API Layer

### File: `packages/api/src/utils/rbac.ts`

Type-safe utility functions for server-side permission checks.

```typescript
// Types
export type RoleName = 'user' | 'moderator' | 'admin'
export type PermissionName =
  | 'users:read' | 'users:write' | 'users:delete' | 'users:manage'
  | 'generations:read' | 'generations:create' | 'generations:delete' | 'generations:manage'
  | 'credits:read' | 'credits:grant' | 'credits:manage'
  | 'analytics:read' | 'admin:access' | 'roles:manage'

// Functions
checkPermission(supabase, userId, permission): Promise<boolean>
checkRole(supabase, userId, role): Promise<boolean>
getUserPermissions(supabase, userId): Promise<PermissionName[]>
getUserRoles(supabase, userId): Promise<RoleName[]>
assignRole(supabase, userId, roleName, assignedBy?): Promise<boolean>
removeRole(supabase, userId, roleName): Promise<boolean>
isAdmin(supabase, userId): Promise<boolean>
isModerator(supabase, userId): Promise<boolean>
```

### File: `packages/api/src/trpc.ts`

tRPC procedure middleware for role-based access.

```typescript
// Requires authentication
export const protectedProcedure = t.procedure.use(...)

// Requires admin role
export const adminProcedure = protectedProcedure.use(async (opts) => {
  const isAdmin = await checkRole(ctx.supabase, ctx.user.id, 'admin')
  if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN' })
  return opts.next({ ctx })
})

// Requires moderator or admin role
export const moderatorProcedure = protectedProcedure.use(...)

// Factory for custom permission checks
export function withPermission(permission: PermissionName) {
  return protectedProcedure.use(async (opts) => {
    const hasPermission = await checkPermission(ctx.supabase, ctx.user.id, permission)
    if (!hasPermission) throw new TRPCError({ code: 'FORBIDDEN' })
    return opts.next({ ctx })
  })
}
```

### File: `packages/api/src/routers/roles.ts`

tRPC router for role management.

| Endpoint | Procedure | Description |
|----------|-----------|-------------|
| `roles.myRoles` | protected | Get current user's roles |
| `roles.myPermissions` | protected | Get current user's permissions |
| `roles.list` | protected | List all available roles |
| `roles.listPermissions` | protected | List all available permissions |
| `roles.getUserRoles` | admin | Get roles for any user |
| `roles.getUserPermissions` | admin | Get permissions for any user |
| `roles.assign` | admin | Assign role to user |
| `roles.remove` | admin | Remove role from user |
| `roles.listUsersWithRoles` | admin | Paginated user list with roles |

---

## Client-Side Usage

### File: `packages/app/provider/SupabaseProvider.tsx`

The SupabaseProvider fetches user roles and permissions on auth state change.

```typescript
interface SupabaseContext {
  user: User | null
  session: Session | null
  loading: boolean
  roles: RoleName[]              // User's assigned roles
  permissions: PermissionName[]  // User's effective permissions
  hasRole: (role: RoleName) => boolean
  hasPermission: (permission: PermissionName) => boolean
  isAdmin: boolean               // Shorthand for hasRole('admin')
  isModerator: boolean           // hasRole('moderator') || hasRole('admin')
  refreshRoles: () => Promise<void>
}
```

### Usage Examples

#### Conditional Rendering

```tsx
import { useSupabase } from 'app/provider/SupabaseProvider'

function AdminPanel() {
  const { isAdmin, hasPermission } = useSupabase()

  if (!isAdmin) {
    return <Text>Access denied</Text>
  }

  return (
    <YStack>
      <Text>Admin Panel</Text>
      {hasPermission('analytics:read') && <AnalyticsWidget />}
      {hasPermission('credits:manage') && <CreditsManager />}
    </YStack>
  )
}
```

#### Protected Component

```tsx
function ProtectedFeature({ children, permission }: {
  children: React.ReactNode
  permission: PermissionName
}) {
  const { hasPermission, loading } = useSupabase()

  if (loading) return <Spinner />
  if (!hasPermission(permission)) return null

  return <>{children}</>
}

// Usage
<ProtectedFeature permission="analytics:read">
  <AnalyticsDashboard />
</ProtectedFeature>
```

#### Role-Based Navigation

```tsx
function Navigation() {
  const { isAdmin, isModerator } = useSupabase()

  return (
    <YStack>
      <Link href="/dashboard">Dashboard</Link>
      {isModerator && <Link href="/moderation">Moderation</Link>}
      {isAdmin && <Link href="/admin">Admin Panel</Link>}
    </YStack>
  )
}
```

---

## Route Protection

### Server-Side: `apps/next/proxy.ts`

The Next.js proxy protects routes before they reach the client.

```typescript
// Protected routes - redirect to login if not authenticated
if ((pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) && !user) {
  return NextResponse.redirect('/login')
}

// Admin routes - check for admin role
if (pathname.startsWith('/admin') && user) {
  const { data: isAdmin } = await supabase.rpc('user_has_role', {
    p_user_id: user.id,
    p_role_name: 'admin',
  })

  if (!isAdmin) {
    return NextResponse.redirect('/dashboard?error=unauthorized')
  }
}
```

### Matcher Configuration

```typescript
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/signup'],
}
```

---

## Common Use Cases

### 1. Admin-Only API Endpoint

```typescript
// packages/api/src/routers/admin.ts
import { adminProcedure, router } from '../trpc'

export const adminRouter = router({
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    // Only admins can access this
    return await getSystemStatistics(ctx.supabase)
  }),
})
```

### 2. Permission-Based API Endpoint

```typescript
import { withPermission, router } from '../trpc'

export const creditsRouter = router({
  grantCredits: withPermission('credits:grant')
    .input(z.object({ userId: z.string(), amount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Only users with credits:grant permission
      return await grantCredits(ctx.supabase, input.userId, input.amount)
    }),
})
```

### 3. Client-Side Permission Check

```tsx
function GrantCreditsButton({ userId }: { userId: string }) {
  const { hasPermission } = useSupabase()
  const grantCredits = trpc.credits.grantCredits.useMutation()

  if (!hasPermission('credits:grant')) {
    return null
  }

  return (
    <Button onPress={() => grantCredits.mutate({ userId, amount: 10 })}>
      Grant 10 Credits
    </Button>
  )
}
```

### 4. Refresh Roles After Assignment

```tsx
function RoleManager() {
  const { refreshRoles } = useSupabase()
  const assignRole = trpc.roles.assign.useMutation({
    onSuccess: async () => {
      // Refresh the current user's roles if they were modified
      await refreshRoles()
    },
  })

  // ...
}
```

---

## Adding New Roles/Permissions

### Step 1: Database Migration

Create a new migration file or update the existing one:

```sql
-- Add new permission
INSERT INTO public.permissions (name, resource, action, description)
VALUES ('reports:generate', 'reports', 'generate', 'Generate reports')
ON CONFLICT (name) DO NOTHING;

-- Assign to roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('moderator', 'admin') AND p.name = 'reports:generate'
ON CONFLICT DO NOTHING;
```

### Step 2: Update TypeScript Types

**`packages/api/src/utils/rbac.ts`**:
```typescript
export type PermissionName =
  | 'users:read'
  // ... existing permissions
  | 'reports:generate'  // Add new permission
```

**`packages/app/provider/SupabaseProvider.tsx`**:
```typescript
export type PermissionName =
  | 'users:read'
  // ... existing permissions
  | 'reports:generate'  // Add new permission
```

### Step 3: Apply Migration

```bash
supabase db push
# or
supabase migration up
```

---

## Security Considerations

### 1. Always Check Server-Side

Never rely solely on client-side permission checks. Always verify permissions in:
- tRPC procedures (using `adminProcedure`, `withPermission()`)
- Next.js proxy for route protection
- Supabase RLS policies for direct database access

### 2. Use SECURITY DEFINER Functions

The RPC functions use `SECURITY DEFINER` to execute with elevated privileges, ensuring RLS policies don't block permission checks.

### 3. Prevent Last Admin Removal

The `roles.remove` mutation includes a check to prevent removing the last admin:

```typescript
// Check if this would remove the last admin
if (roleName === 'admin') {
  const { count } = await ctx.supabase
    .from('user_roles')
    .select('*', { count: 'exact' })
    .eq('role_id', roleId)

  if (count === 1) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot remove the last admin',
    })
  }
}
```

### 4. Audit Trail

The `user_roles` table includes `assigned_by` and `assigned_at` columns for tracking who assigned roles and when.

### 5. RLS on RBAC Tables

All RBAC tables have RLS enabled:
- Read access is generally open (users need to see available roles/permissions)
- Write access requires `roles:manage` permission (admins only)

---

## Troubleshooting

### User doesn't have expected permissions

1. Check if the user has the role assigned:
   ```sql
   SELECT * FROM get_user_roles('user-uuid-here');
   ```

2. Check if the role has the permission:
   ```sql
   SELECT p.name FROM role_permissions rp
   JOIN permissions p ON p.id = rp.permission_id
   JOIN roles r ON r.id = rp.role_id
   WHERE r.name = 'role-name';
   ```

3. Refresh roles client-side:
   ```typescript
   const { refreshRoles } = useSupabase()
   await refreshRoles()
   ```

### New user doesn't have default role

Check if the trigger is working:
```sql
SELECT * FROM user_roles WHERE user_id = 'user-uuid-here';
```

If empty, manually assign:
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT 'user-uuid-here', id FROM roles WHERE name = 'user';
```

### RLS blocking operations

Ensure the user has `roles:manage` permission for write operations on RBAC tables. Admin role includes this by default.
