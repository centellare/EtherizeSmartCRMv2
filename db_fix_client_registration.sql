-- SmartHome CRM: CLIENT REGISTRATION FIX (v15.0)
-- Исправляет конфликт регистрации клиентов с системой подтверждения.

BEGIN;

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create smarter handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_approved boolean;
  v_client_id uuid;
BEGIN
  -- Extract role from metadata, default to 'specialist'
  -- Clients created via admin panel usually have role='client' in metadata
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'specialist');
  
  -- Extract client_id if present (for linking profile to client record)
  IF new.raw_user_meta_data->>'client_id' IS NOT NULL THEN
    v_client_id := (new.raw_user_meta_data->>'client_id')::uuid;
  END IF;

  -- Determine approval status
  -- If role is 'client', they are created by admin, so AUTO-APPROVE.
  -- If role is 'specialist', they need approval (default false).
  IF v_role = 'client' THEN
    v_approved := true;
  ELSE
    v_approved := false;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, is_approved, client_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    v_role,
    v_approved,
    v_client_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- 3. Recreate Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
