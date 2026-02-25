-- db_security_update.sql

BEGIN;

-- 1. Add is_approved column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- 2. Approve all existing users (migration)
UPDATE public.profiles SET is_approved = true WHERE is_approved IS FALSE;

-- 3. Update get_my_role to respect approval status
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
  v_approved boolean;
BEGIN
  SELECT role, is_approved INTO v_role, v_approved FROM public.profiles WHERE id = auth.uid();
  
  -- If user is approved, return their actual role
  IF v_approved = true THEN
    RETURN v_role;
  -- If not approved (or not found), return 'unverified' to block RLS access
  ELSE
    RETURN 'unverified';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update handle_new_user trigger to set default false and notify admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

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

  -- If it's a new unapproved user, notify existing admins/directors
  IF NOT is_first_user THEN
    INSERT INTO public.notifications (profile_id, content, link)
    SELECT id, 'Новая регистрация: Пользователь ' || new.email || ' ожидает подтверждения.', '/team'
    FROM public.profiles 
    WHERE role IN ('admin', 'director');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
