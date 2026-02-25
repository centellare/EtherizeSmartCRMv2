-- SmartHome CRM: ADMIN MANAGE USER FUNCTION (v17.0)
-- Позволяет администраторам управлять ролями и статусом пользователей через RPC.

BEGIN;

-- 1. Create function to update user profile (role, approval)
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  target_user_id uuid,
  new_role text,
  new_approval_status boolean
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if executing user is admin or director
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'director')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET 
    role = new_role,
    is_approved = new_approval_status,
    updated_at = now()
  WHERE id = target_user_id;
  
  -- Also update metadata in auth.users to keep it in sync (optional but good for debugging)
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role)
  WHERE id = target_user_id;

END;
$$;

-- 2. Revert trigger to "dumb" mode (ignore metadata roles for security)
-- This ensures that even if someone calls signUp with role='admin', 
-- the trigger will force them to be 'specialist' and 'unapproved'.
-- Only the admin_update_profile function (which checks permissions) can promote them.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Extract client_id if present (for linking profile to client record)
  IF new.raw_user_meta_data->>'client_id' IS NOT NULL THEN
    v_client_id := (new.raw_user_meta_data->>'client_id')::uuid;
  END IF;

  -- ALWAYS insert as specialist / unapproved initially.
  -- The Admin UI will immediately call admin_update_profile to fix this.
  INSERT INTO public.profiles (id, full_name, email, role, is_approved, client_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    'specialist', -- Default safe role
    false,        -- Default unapproved
    v_client_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

COMMIT;
