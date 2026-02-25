-- SmartHome CRM: REGISTRATION FIX (v12.0)
-- Исправляет ошибку при регистрации нового пользователя.

BEGIN;

-- 1. Drop existing trigger and function to ensure clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Recreate handle_new_user with robust error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  -- Insert Profile
  INSERT INTO public.profiles (id, full_name, email, role, is_approved)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    -- First user is director, others are specialist
    CASE WHEN is_first_user THEN 'director' ELSE 'specialist' END,
    -- First user is auto-approved, others need approval
    CASE WHEN is_first_user THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Notify admins (wrapped in block to prevent registration failure if notification fails)
  IF NOT is_first_user THEN
    BEGIN
      INSERT INTO public.notifications (profile_id, content, link)
      SELECT id, 'Новая регистрация: Пользователь ' || new.email || ' ожидает подтверждения.', '/team'
      FROM public.profiles 
      WHERE role IN ('admin', 'director');
    EXCEPTION WHEN OTHERS THEN
      -- Log error but allow user creation to proceed
      RAISE WARNING 'Failed to create notification for new user: %', SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
