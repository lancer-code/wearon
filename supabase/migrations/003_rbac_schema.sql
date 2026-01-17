-- RBAC (Role-Based Access Control) Schema
-- Migration: 003_rbac_schema

-- Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,  -- e.g., 'users', 'generations', 'credits', 'admin'
  action TEXT NOT NULL,    -- e.g., 'read', 'write', 'delete', 'manage', 'access'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-Permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- User-Roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('user', 'Regular user with standard access'),
  ('moderator', 'Moderator with limited admin access'),
  ('admin', 'Administrator with full access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  -- User permissions
  ('users:read', 'users', 'read', 'View user profiles'),
  ('users:write', 'users', 'write', 'Edit user profiles'),
  ('users:delete', 'users', 'delete', 'Delete users'),
  ('users:manage', 'users', 'manage', 'Full user management'),
  -- Generation permissions
  ('generations:read', 'generations', 'read', 'View generations'),
  ('generations:create', 'generations', 'create', 'Create generations'),
  ('generations:delete', 'generations', 'delete', 'Delete generations'),
  ('generations:manage', 'generations', 'manage', 'Full generation management'),
  -- Credit permissions
  ('credits:read', 'credits', 'read', 'View credit balance'),
  ('credits:grant', 'credits', 'grant', 'Grant credits to users'),
  ('credits:manage', 'credits', 'manage', 'Full credit management'),
  -- Analytics permissions
  ('analytics:read', 'analytics', 'read', 'View analytics'),
  -- Admin permissions
  ('admin:access', 'admin', 'access', 'Access admin panel'),
  ('roles:manage', 'roles', 'manage', 'Manage user roles')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Get role IDs
DO $$
DECLARE
  v_user_role_id UUID;
  v_moderator_role_id UUID;
  v_admin_role_id UUID;
BEGIN
  SELECT id INTO v_user_role_id FROM public.roles WHERE name = 'user';
  SELECT id INTO v_moderator_role_id FROM public.roles WHERE name = 'moderator';
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin';

  -- User role permissions (basic access)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_user_role_id, id FROM public.permissions
  WHERE name IN ('generations:read', 'generations:create', 'credits:read')
  ON CONFLICT DO NOTHING;

  -- Moderator role permissions (user + extra)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_moderator_role_id, id FROM public.permissions
  WHERE name IN (
    'generations:read', 'generations:create', 'credits:read',
    'users:read', 'analytics:read', 'generations:manage'
  )
  ON CONFLICT DO NOTHING;

  -- Admin role permissions (all)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_admin_role_id, id FROM public.permissions
  ON CONFLICT DO NOTHING;
END $$;

-- Function to assign default role on user creation
CREATE OR REPLACE FUNCTION assign_default_role()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role_id UUID;
BEGIN
  SELECT id INTO v_user_role_id FROM public.roles WHERE name = 'user';

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, v_user_role_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to assign default role after user is created
DROP TRIGGER IF EXISTS on_user_created_assign_role ON public.users;
CREATE TRIGGER on_user_created_assign_role
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_role();

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND p.name = p_permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION user_has_role(p_user_id UUID, p_role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.name = p_role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (permission_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all user roles
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TABLE (role_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for RBAC tables

-- Roles table: Anyone can read, only admins can modify
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view roles"
  ON public.roles FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert roles"
  ON public.roles FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can update roles"
  ON public.roles FOR UPDATE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can delete roles"
  ON public.roles FOR DELETE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

-- Permissions table: Anyone can read, only admins can modify
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permissions"
  ON public.permissions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can update permissions"
  ON public.permissions FOR UPDATE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can delete permissions"
  ON public.permissions FOR DELETE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

-- Role-Permissions table: Anyone can read, only admins can modify
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role_permissions"
  ON public.role_permissions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert role_permissions"
  ON public.role_permissions FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can delete role_permissions"
  ON public.role_permissions FOR DELETE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

-- User-Roles table: Users can view their own, admins can manage all
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'roles:manage'));

CREATE POLICY "Only admins can remove roles"
  ON public.user_roles FOR DELETE
  USING (user_has_permission(auth.uid(), 'roles:manage'));

-- Comments
COMMENT ON TABLE public.roles IS 'Available roles in the system';
COMMENT ON TABLE public.permissions IS 'Available permissions in the system';
COMMENT ON TABLE public.role_permissions IS 'Maps roles to their permissions';
COMMENT ON TABLE public.user_roles IS 'Maps users to their assigned roles';
COMMENT ON FUNCTION user_has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION user_has_role IS 'Check if a user has a specific role';
COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user';
COMMENT ON FUNCTION get_user_roles IS 'Get all roles for a user';
