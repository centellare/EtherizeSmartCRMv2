
import { TableSchema } from './types';

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'products',
    description: 'Номенклатура (Расширенная)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'manufacturer', type: 'text', description: 'Бренд/Поставщик' },
        { name: 'origin_country', type: 'text', description: 'Страна' },
        { name: 'weight', type: 'numeric', description: 'Вес (кг)' },
        { name: 'markup_percent', type: 'numeric', description: 'Индивидуальная наценка' }
    ]
  },
  {
    name: 'cp_items',
    description: 'Позиции КП (с поддержкой вложенности)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'cp_id', type: 'uuid', references: 'commercial_proposals' },
        { name: 'product_id', type: 'uuid', references: 'products', description: 'Может быть NULL для заголовка комплекта' },
        { name: 'parent_id', type: 'uuid', references: 'cp_items', description: 'Ссылка на родительскую строку (комплект)' }
    ]
  },
  {
    name: 'invoice_items',
    description: 'Позиции Счета (с поддержкой вложенности)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'invoice_id', type: 'uuid', references: 'invoices' },
        { name: 'parent_id', type: 'uuid', references: 'invoice_items' }
    ]
  },
  {
    name: 'price_rules',
    description: 'Правила наценок для категорий',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'category_name', type: 'text' },
        { name: 'markup_delta', type: 'numeric', description: 'Поправка категории (%)' }
    ]
  },
  {
    name: 'client_connections',
    description: 'Связи между клиентами',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'client_a', type: 'uuid', references: 'clients' },
        { name: 'client_b', type: 'uuid', references: 'clients' },
        { name: 'type', type: 'text' }
    ]
  },
  {
    name: 'partners',
    description: 'Партнеры (B2B)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'name', type: 'text' },
        { name: 'contact_person', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'default_commission_percent', type: 'numeric', description: 'Процент комиссии' },
        { name: 'status', type: 'text', description: 'active | inactive' },
        { name: 'notes', type: 'text' }
    ]
  }
];

export const MIGRATION_SQL_V21 = `
-- SmartHome CRM: FINANCIAL ANALYTICS (v21.0)
-- Добавляет поля для структурированной аналитики финансов.

BEGIN;

-- 1. Add section column to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS section text;

-- 2. Ensure description column exists (renaming UI concept 'Category' -> 'Comment')
-- If description doesn't exist, create it.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description text;

-- 3. Optional: Migrate old 'category' data to 'description' if description is empty
-- This preserves old free-text categories as comments.
UPDATE public.transactions 
SET description = category 
WHERE description IS NULL AND category IS NOT NULL;

-- 4. Clear old category column to prepare for new structured data?
-- No, let's keep it. We will just overwrite it with new dropdown values.
-- But for historical data, it might be messy. 
-- Let's leave it as is. The UI will show 'Other' or custom if not in list.

COMMIT;
`;

export const MIGRATION_SQL_V18 = `
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
`;

export const MIGRATION_SQL_V19 = `
-- SmartHome CRM: SECURITY HARDENING (v19.0)
-- Добавляет проверки прав доступа в критические функции (RPC).

BEGIN;

-- 1. Secure create_task_safe
CREATE OR REPLACE FUNCTION public.create_task_safe(
    p_object_id uuid,
    p_title text,
    p_assigned_to uuid,
    p_start_date date,
    p_deadline date,
    p_comment text,
    p_doc_link text,
    p_doc_name text,
    p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_task_id uuid;
    v_stage text;
    v_role text;
    v_is_responsible boolean;
BEGIN
    -- Get current user role and responsibility
    v_role := public.get_my_role();
    
    -- Check permissions
    -- Admin/Director/Manager: Allow
    -- Specialist: Allow ONLY if responsible for the object
    IF v_role NOT IN ('admin', 'director', 'manager') THEN
        SELECT (responsible_id = auth.uid()) INTO v_is_responsible FROM public.objects WHERE id = p_object_id;
        IF v_is_responsible IS NOT TRUE THEN
            RAISE EXCEPTION 'Access denied: Only managers or responsible specialist can create tasks';
        END IF;
    END IF;

    SELECT current_stage INTO v_stage FROM public.objects WHERE id = p_object_id;

    INSERT INTO public.tasks (
        object_id, title, assigned_to, start_date, deadline, 
        comment, doc_link, doc_name, created_by, stage_id, status
    ) VALUES (
        p_object_id, p_title, p_assigned_to, p_start_date, p_deadline,
        p_comment, p_doc_link, p_doc_name, p_user_id, v_stage, 'pending'
    ) RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Secure transition_object_stage
CREATE OR REPLACE FUNCTION public.transition_object_stage(
    p_object_id uuid,
    p_next_stage text,
    p_responsible_id uuid,
    p_deadline timestamptz,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_stage text;
BEGIN
    -- Permission check: Only Admin, Director, Manager
    IF public.get_my_role() NOT IN ('admin', 'director', 'manager') THEN
        RAISE EXCEPTION 'Access denied: Only management can change stages';
    END IF;

    SELECT current_stage INTO v_current_stage FROM public.objects WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now() 
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at, responsible_id, deadline
    ) VALUES (
        p_object_id, p_next_stage, 'active', now(), p_responsible_id, p_deadline
    );

    UPDATE public.objects 
    SET current_stage = p_next_stage, 
        responsible_id = p_responsible_id,
        current_status = 'in_work',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Переход на этап: ' || p_next_stage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Secure rollback_object_stage
CREATE OR REPLACE FUNCTION public.rollback_object_stage(
    p_object_id uuid,
    p_target_stage text,
    p_reason text,
    p_responsible_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_stage text;
BEGIN
    -- Permission check
    IF public.get_my_role() NOT IN ('admin', 'director', 'manager') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT current_stage INTO v_current_stage FROM public.objects WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'rolled_back', completed_at = now()
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at, responsible_id
    ) VALUES (
        p_object_id, p_target_stage, 'active', now(), p_responsible_id
    );

    UPDATE public.objects 
    SET current_stage = p_target_stage,
        rolled_back_from = v_current_stage,
        responsible_id = p_responsible_id,
        current_status = 'review_required',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Возврат этапа: ' || p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Secure restore_object_stage
CREATE OR REPLACE FUNCTION public.restore_object_stage(
    p_object_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_rolled_from text;
BEGIN
    -- Permission check
    IF public.get_my_role() NOT IN ('admin', 'director', 'manager') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT rolled_back_from INTO v_rolled_from FROM public.objects WHERE id = p_object_id;
    
    IF v_rolled_from IS NULL THEN
        RAISE EXCEPTION 'Нет информации для восстановления этапа';
    END IF;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now()
    WHERE object_id = p_object_id AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at
    ) VALUES (
        p_object_id, v_rolled_from, 'active', now()
    );

    UPDATE public.objects 
    SET current_stage = v_rolled_from,
        rolled_back_from = NULL,
        current_status = 'in_work',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Восстановление этапа после доработки');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Secure finalize_project
CREATE OR REPLACE FUNCTION public.finalize_project(
    p_object_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
BEGIN
    -- Permission check
    IF public.get_my_role() NOT IN ('admin', 'director', 'manager') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE public.objects 
    SET current_status = 'completed',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now() 
    WHERE object_id = p_object_id AND status = 'active';

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Проект успешно завершен');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
`;
export const MIGRATION_SQL_V20 = `
-- SmartHome CRM: PRIVACY HARDENING (v20.0)
-- Ограничивает видимость данных клиентов и профилей.

BEGIN;

-- 1. Profiles Privacy
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by staff and self" ON public.profiles
FOR SELECT USING (
  (public.get_my_role() IN ('admin', 'director', 'manager', 'specialist', 'storekeeper')) 
  OR 
  (id = auth.uid())
);

-- 2. Clients Privacy
DROP POLICY IF EXISTS "Clients view" ON public.clients;
CREATE POLICY "Clients viewable by staff and self" ON public.clients
FOR SELECT USING (
  (public.get_my_role() IN ('admin', 'director', 'manager', 'specialist', 'storekeeper')) 
  OR 
  (id = (SELECT client_id FROM public.profiles WHERE id = auth.uid()))
);

COMMIT;
`;
export const MIGRATION_SQL_V17 = `
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
`;

export const MIGRATION_SQL_V16 = `
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
`;

export const MIGRATION_SQL_V15 = `
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
`;

export const MIGRATION_SQL_V14 = `
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
`;

export const MIGRATION_SQL_V13 = `
-- SmartHome CRM: REGISTRATION RECOVERY (v13.0)
-- Экстренное исправление регистрации. Отключает уведомления и проверяет структуру.

BEGIN;

-- 1. Ensure is_approved column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- 2. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Create minimal handle_new_user (NO NOTIFICATIONS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Check if this is the first user
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;

  -- Insert Profile
  INSERT INTO public.profiles (id, full_name, email, role, is_approved)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    CASE WHEN is_first_user THEN 'director' ELSE 'specialist' END,
    CASE WHEN is_first_user THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
`;

export const MIGRATION_SQL_V12 = `
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
`;

export const MIGRATION_SQL_V11 = `
-- SmartHome CRM: SECURITY & APPROVALS (v11.0)
-- Добавляет систему подтверждения регистрации и функции администрирования.

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

-- 5. Function to allow admins to update user credentials
CREATE OR REPLACE FUNCTION admin_update_user_credentials(
  target_user_id UUID,
  new_email TEXT DEFAULT NULL,
  new_password TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Check if executing user is admin or director
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'director')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update email if provided
  IF new_email IS NOT NULL AND new_email != '' THEN
    UPDATE auth.users SET email = new_email, updated_at = now() WHERE id = target_user_id;
    UPDATE public.profiles SET email = new_email, updated_at = now() WHERE id = target_user_id;
  END IF;

  -- Update password if provided
  IF new_password IS NOT NULL AND new_password != '' THEN
    UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() WHERE id = target_user_id;
  END IF;
END;
$$;

COMMIT;
`;

export const MIGRATION_SQL_V10 = `
-- SmartHome CRM: DOCUMENT CUSTOMIZATION (v10.0)
-- Добавляет поля для кастомизации текста в КП и Счетах.

BEGIN;

-- 1. Add fields to commercial_proposals
ALTER TABLE public.commercial_proposals ADD COLUMN IF NOT EXISTS preamble text;
ALTER TABLE public.commercial_proposals ADD COLUMN IF NOT EXISTS footer text;

-- 2. Add fields to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS preamble text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS footer text;

COMMIT;
`;

export const MIGRATION_SQL_V9 = `
-- SmartHome CRM: TELEGRAM NOTIFICATIONS (v9.0)
-- Добавляет поле telegram_chat_id в таблицу профилей.

BEGIN;

-- 1. Add telegram_chat_id column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

COMMIT;
`;

export const MIGRATION_SQL_V8 = `
-- SmartHome CRM: NOTIFICATIONS LINK (v8.0)
-- Добавляет поле link в таблицу уведомлений для кликабельности.

BEGIN;

-- 1. Add link column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

COMMIT;
`;

export const MIGRATION_SQL_V7 = `
-- SmartHome CRM: PARTNERS MODULE (v7.0)
-- Добавляет таблицу партнеров и связь с клиентами.

BEGIN;

-- 1. Create Partners Table
CREATE TABLE IF NOT EXISTS public.partners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    default_commission_percent numeric DEFAULT 10,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Update Clients Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id);

-- 3. RLS Policies for Partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners view" ON public.partners;
CREATE POLICY "Partners view" ON public.partners FOR SELECT USING (
    get_my_role() IN ('admin', 'director', 'manager')
);

DROP POLICY IF EXISTS "Partners manage" ON public.partners;
CREATE POLICY "Partners manage" ON public.partners FOR ALL USING (
    get_my_role() IN ('admin', 'director')
);

COMMIT;
`;

export const MIGRATION_SQL_V6 = `
-- SmartHome CRM: FULL LOGIC RESET v6.6 (Task Checklists & Questions RLS Fix)
-- Исправлены права доступа для чек-листов и вопросов в задачах.

BEGIN;

--------------------------------------------------------------------------------
-- 1. SMART CLEANUP
--------------------------------------------------------------------------------

-- 1.1 Удаляем политики (RLS)
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON "public"."' || r.tablename || '";'; 
    END LOOP; 
END $$;

-- 1.2 Удаляем триггеры
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_objects_updated_at ON public.objects;

-- 1.3 УМНОЕ удаление функций
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT ns.nspname, p.proname, oidvectortypes(p.proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public' 
        AND p.proname IN (
            'handle_new_user', 
            'create_task_safe', 
            'transition_object_stage', 
            'rollback_object_stage', 
            'restore_object_stage', 
            'finalize_project', 
            'get_finance_analytics',
            'get_my_role'
        )
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS "' || r.nspname || '"."' || r.proname || '"(' || r.args || ') CASCADE;';
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 2. DATA TYPE FIXES
--------------------------------------------------------------------------------

ALTER TABLE public.products DROP COLUMN IF EXISTS markup_percent;

ALTER TABLE public.transactions ALTER COLUMN amount TYPE numeric USING amount::numeric;
ALTER TABLE public.transactions ALTER COLUMN fact_amount TYPE numeric USING fact_amount::numeric;
ALTER TABLE public.transactions ALTER COLUMN planned_amount TYPE numeric USING planned_amount::numeric;
ALTER TABLE public.transactions ALTER COLUMN requested_amount TYPE numeric USING requested_amount::numeric;

ALTER TABLE public.products ALTER COLUMN base_price TYPE numeric USING base_price::numeric;
ALTER TABLE public.products ALTER COLUMN retail_price TYPE numeric USING retail_price::numeric;

ALTER TABLE public.inventory_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.inventory_items ALTER COLUMN purchase_price TYPE numeric USING purchase_price::numeric;

ALTER TABLE public.invoice_items ALTER COLUMN price TYPE numeric USING price::numeric;
ALTER TABLE public.invoice_items ALTER COLUMN total TYPE numeric USING total::numeric;
ALTER TABLE public.invoice_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.cp_items ALTER COLUMN price_at_moment TYPE numeric USING price_at_moment::numeric;
ALTER TABLE public.cp_items ALTER COLUMN final_price_byn TYPE numeric USING final_price_byn::numeric;
ALTER TABLE public.cp_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

ALTER TABLE public.transaction_payments ALTER COLUMN amount TYPE numeric USING amount::numeric;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 0;

UPDATE public.products 
SET markup_percent = CASE 
    WHEN base_price > 0 THEN ROUND(((retail_price - base_price) / base_price) * 100, 2)
    ELSE 0 
END;

--------------------------------------------------------------------------------
-- 3. CORE FUNCTIONS
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_task_safe(
    p_object_id uuid,
    p_title text,
    p_assigned_to uuid,
    p_start_date date,
    p_deadline date,
    p_comment text,
    p_doc_link text,
    p_doc_name text,
    p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_task_id uuid;
    v_stage text;
BEGIN
    SELECT current_stage INTO v_stage FROM public.objects WHERE id = p_object_id;

    INSERT INTO public.tasks (
        object_id, title, assigned_to, start_date, deadline, 
        comment, doc_link, doc_name, created_by, stage_id, status
    ) VALUES (
        p_object_id, p_title, p_assigned_to, p_start_date, p_deadline,
        p_comment, p_doc_link, p_doc_name, p_user_id, v_stage, 'pending'
    ) RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.transition_object_stage(
    p_object_id uuid,
    p_next_stage text,
    p_responsible_id uuid,
    p_deadline timestamptz,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_stage text;
BEGIN
    SELECT current_stage INTO v_current_stage FROM public.objects WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now() 
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at, responsible_id, deadline
    ) VALUES (
        p_object_id, p_next_stage, 'active', now(), p_responsible_id, p_deadline
    );

    UPDATE public.objects 
    SET current_stage = p_next_stage, 
        responsible_id = p_responsible_id,
        current_status = 'in_work',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Переход на этап: ' || p_next_stage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rollback_object_stage(
    p_object_id uuid,
    p_target_stage text,
    p_reason text,
    p_responsible_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_current_stage text;
BEGIN
    SELECT current_stage INTO v_current_stage FROM public.objects WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'rolled_back', completed_at = now()
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at, responsible_id
    ) VALUES (
        p_object_id, p_target_stage, 'active', now(), p_responsible_id
    );

    UPDATE public.objects 
    SET current_stage = p_target_stage,
        rolled_back_from = v_current_stage,
        responsible_id = p_responsible_id,
        current_status = 'review_required',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Возврат этапа: ' || p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_object_stage(
    p_object_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
DECLARE
    v_rolled_from text;
BEGIN
    SELECT rolled_back_from INTO v_rolled_from FROM public.objects WHERE id = p_object_id;
    
    IF v_rolled_from IS NULL THEN
        RAISE EXCEPTION 'Нет информации для восстановления этапа';
    END IF;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now()
    WHERE object_id = p_object_id AND status = 'active';

    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at
    ) VALUES (
        p_object_id, v_rolled_from, 'active', now()
    );

    UPDATE public.objects 
    SET current_stage = v_rolled_from,
        rolled_back_from = NULL,
        current_status = 'in_work',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Восстановление этапа после доработки');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.finalize_project(
    p_object_id uuid,
    p_user_id uuid
)
RETURNS void AS $$
BEGIN
    UPDATE public.objects 
    SET current_status = 'completed',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now() 
    WHERE object_id = p_object_id AND status = 'active';

    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Проект успешно завершен');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- UPDATED TRIGGER: Handles missing metadata gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    -- Если имя не передано (создание через админку Supabase), используем email или заглушку
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'New User'), 
    new.email, 
    'specialist'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--------------------------------------------------------------------------------
-- 4. RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_history ENABLE ROW LEVEL SECURITY;

-- 4.1 PROFILES
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles update own or admin" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR get_my_role() IN ('admin', 'director')
);

-- 4.2 OBJECTS
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM tasks WHERE object_id = objects.id AND assigned_to = auth.uid())
);
CREATE POLICY "Objects edit" ON public.objects FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager')
);

-- 4.3 TASKS
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR created_by = auth.uid()
);
CREATE POLICY "Tasks edit" ON public.tasks FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR created_by = auth.uid()
);

-- 4.3.1 TASK CHECKLISTS & QUESTIONS
CREATE POLICY "Checklists view" ON public.task_checklists FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Checklists manage" ON public.task_checklists FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Questions view" ON public.task_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Questions manage" ON public.task_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

-- 4.4 TRANSACTIONS (Finances)
CREATE POLICY "Trans view" ON public.transactions FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR created_by = auth.uid()
);
CREATE POLICY "Trans admin" ON public.transactions FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);
CREATE POLICY "Trans specialist" ON public.transactions FOR INSERT WITH CHECK (
  get_my_role() = 'specialist'
);

-- 4.5 TRANSACTION PAYMENTS (FIXED)
CREATE POLICY "Payments manage" ON public.transaction_payments FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);
CREATE POLICY "Payments view" ON public.transaction_payments FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.created_by = auth.uid())
);

-- 4.6 INVENTORY & PRODUCTS
CREATE POLICY "Inventory view" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Products view" ON public.products FOR SELECT USING (true);
CREATE POLICY "Inventory manage" ON public.inventory_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);
CREATE POLICY "Products manage" ON public.products FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

-- 4.7 CLIENTS
CREATE POLICY "Clients view" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Clients manage" ON public.clients FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager')
);

-- 4.8 COMMERCIAL PROPOSALS (КП) & ITEMS
CREATE POLICY "CP view" ON public.commercial_proposals FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR created_by = auth.uid()
);
CREATE POLICY "CP manage" ON public.commercial_proposals FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

CREATE POLICY "CP Items view" ON public.cp_items FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);
CREATE POLICY "CP Items manage" ON public.cp_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

-- 4.9 INVOICES (Счета) & ITEMS
CREATE POLICY "Invoices view" ON public.invoices FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);
CREATE POLICY "Invoices manage" ON public.invoices FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

CREATE POLICY "Inv Items view" ON public.invoice_items FOR SELECT USING (true);
CREATE POLICY "Inv Items manage" ON public.invoice_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

-- 4.10 SUPPLY ORDERS (Снабжение)
CREATE POLICY "Supply view" ON public.supply_orders FOR SELECT USING (true);
CREATE POLICY "Supply manage" ON public.supply_orders FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

CREATE POLICY "Supply Items view" ON public.supply_order_items FOR SELECT USING (true);
CREATE POLICY "Supply Items manage" ON public.supply_order_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

-- 4.11 SETTINGS & TEMPLATES
CREATE POLICY "Settings view" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "Settings manage" ON public.company_settings FOR ALL USING (
  get_my_role() IN ('admin', 'director')
);

CREATE POLICY "Templates view" ON public.document_templates FOR SELECT USING (true);
CREATE POLICY "Templates manage" ON public.document_templates FOR ALL USING (
  get_my_role() IN ('admin', 'director')
);

CREATE POLICY "Rules view" ON public.price_rules FOR SELECT USING (true);
CREATE POLICY "Rules manage" ON public.price_rules FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper')
);

-- 4.12 UTILS (Connections, Notifications, History)
CREATE POLICY "Conn view" ON public.client_connections FOR SELECT USING (true);
CREATE POLICY "Conn manage" ON public.client_connections FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager')
);

CREATE POLICY "Notif view own" ON public.notifications FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Notif update own" ON public.notifications FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Notif insert system" ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "History view" ON public.object_history FOR SELECT USING (true);
CREATE POLICY "History manage" ON public.object_history FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR profile_id = auth.uid()
);

COMMIT;
`;

export const MIGRATION_SQL_V5 = MIGRATION_SQL_V7;
export const SUPABASE_SETUP_GUIDE = `
### ВАЖНО: Обновление Партнеры (v7.0)
1. Скопируйте SQL-скрипт обновления.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это добавит таблицу партнеров и связь с клиентами.
`;