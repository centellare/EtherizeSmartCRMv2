-- SmartHome CRM: REGISTRATION FIX FINAL (v14.0)
-- Максимальное упрощение триггера регистрации для устранения блокировок.

BEGIN;

-- 1. Drop everything related to the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a DEAD SIMPLE handler (No SELECTs, No Logic, Just Insert)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_approved)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    'specialist', -- Default role
    false         -- Default approval status (safety first)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- 3. Recreate Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Add explicit INSERT policy for profiles (Backup)
DROP POLICY IF EXISTS "Profiles insert self" ON public.profiles;
CREATE POLICY "Profiles insert self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

COMMIT;
