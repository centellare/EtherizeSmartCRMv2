-- SmartHome CRM: FIX ROLE CASTING (v18.0)
-- Исправляет ошибку типов при назначении роли (text -> user_role).

BEGIN;

-- 1. Replace function with explicit casting
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

  -- Update profile with EXPLICIT CAST to user_role enum
  UPDATE public.profiles
  SET 
    role = new_role::public.user_role,
    is_approved = new_approval_status,
    updated_at = now()
  WHERE id = target_user_id;
  
  -- Update metadata (keep as text/jsonb)
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role)
  WHERE id = target_user_id;

END;
$$;

COMMIT;
