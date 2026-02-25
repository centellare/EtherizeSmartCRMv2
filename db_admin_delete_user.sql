-- SmartHome CRM: ADMIN DELETE USER FUNCTION (v16.0)
-- Позволяет администраторам удалять пользователей через RPC.

BEGIN;

-- 1. Create function to delete user by ID
CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id uuid)
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

  -- Delete from auth.users (cascade will handle profile)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

COMMIT;
