-- db_client_auth.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text;
  v_client_id uuid;
BEGIN
  -- Extract role and client_id from metadata if provided, otherwise default to 'specialist'
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'specialist');
  
  -- Handle client_id safely
  IF new.raw_user_meta_data->>'client_id' IS NOT NULL THEN
    v_client_id := (new.raw_user_meta_data->>'client_id')::uuid;
  ELSE
    v_client_id := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, client_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    v_role::public.user_role,
    v_client_id
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    client_id = EXCLUDED.client_id;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
