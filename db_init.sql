-- ==========================================
-- FILE: db_questions_feature.sql
-- ==========================================

create table if not exists task_questions (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  question text not null,
  answer text,
  answered_at timestamptz,
  answered_by uuid references profiles(id),
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

alter table task_questions enable row level security;

create policy "Users can view task questions"
  on task_questions for select
  using ( true );

create policy "Users can insert task questions"
  on task_questions for insert
  with check ( auth.uid() = created_by );

create policy "Users can update task questions"
  on task_questions for update
  using ( true );

create policy "Users can delete task questions"
  on task_questions for delete
  using ( auth.uid() = created_by );


-- ==========================================
-- FILE: db_fix_tasks_rls.sql
-- ==========================================

-- Fix RLS policies for Task Checklists and Questions
-- This script enables RLS and adds policies that delegate access control to the parent Task.

BEGIN;

-- 1. Enable RLS
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Checklists view" ON public.task_checklists;
DROP POLICY IF EXISTS "Checklists manage" ON public.task_checklists;
DROP POLICY IF EXISTS "Questions view" ON public.task_questions;
DROP POLICY IF EXISTS "Questions manage" ON public.task_questions;
DROP POLICY IF EXISTS "Users can view task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can insert task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can update task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can delete task questions" ON public.task_questions;

-- 3. Create Policies for Task Checklists
-- Allow view if user has access to the parent task
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

-- Allow manage (insert/update/delete) if user has access to the parent task
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

-- 4. Create Policies for Task Questions
-- Allow view if user has access to the parent task
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

-- Allow manage if user has access to the parent task
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

COMMIT;


-- ==========================================
-- FILE: db_fix_payments.sql
-- ==========================================

-- SmartHome CRM: PATCH v6.4 (Payments Fix)
-- Этот патч добавляет пропущенные права доступа для таблицы платежей.
-- Выполните этот скрипт, если получаете ошибку при добавлении оплаты/поступления.

BEGIN;

-- 1. Включаем защиту (если еще не включена)
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем старые политики этой таблицы (на всякий случай, чтобы избежать конфликтов имен)
DROP POLICY IF EXISTS "Payments manage" ON public.transaction_payments;
DROP POLICY IF EXISTS "Payments view" ON public.transaction_payments;

-- 3. Добавляем права на УПРАВЛЕНИЕ (создание, редактирование, удаление)
-- Разрешено: Админ, Директор, Менеджер, Снабжение/Финансы
CREATE POLICY "Payments manage" ON public.transaction_payments
FOR ALL
USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

-- 4. Добавляем права на ПРОСМОТР
-- Разрешено: Руководству (все) и Специалистам (только платежи по их транзакциям, если таковые будут)
CREATE POLICY "Payments view" ON public.transaction_payments
FOR SELECT
USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') 
  OR 
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_id AND t.created_by = auth.uid()
  )
);

COMMIT;


-- ==========================================
-- FILE: db_reset.sql
-- ==========================================

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

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

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

CREATE OR REPLACE FUNCTION public.has_object_task(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.tasks WHERE object_id = obj_id AND assigned_to = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_client_object(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.objects o
    JOIN public.profiles p ON p.client_id = o.client_id
    WHERE o.id = obj_id AND p.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 OBJECTS
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  public.has_object_task(id, auth.uid()) OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "Objects edit" ON public.objects FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager')
);

-- 4.3 TASKS
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  public.is_client_object(object_id, auth.uid())
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


-- ==========================================
-- FILE: db_security_update.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_client_portal.sql
-- ==========================================

-- db_client_portal.sql

-- 1. Add 'client' to user_role ENUM (cannot run inside a transaction block)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Add client_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Update RLS for objects so clients can see their own objects
CREATE OR REPLACE FUNCTION public.has_object_task(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.tasks WHERE object_id = obj_id AND assigned_to = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_client_object(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.objects o
    JOIN public.profiles p ON p.client_id = o.client_id
    WHERE o.id = obj_id AND p.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  public.has_object_task(id, auth.uid()) OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 4. Update RLS for tasks so clients can see tasks for their objects
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  public.is_client_object(object_id, auth.uid())
);

-- 5. Update RLS for invoices so clients can see their invoices
DROP POLICY IF EXISTS "Invoices view" ON public.invoices;
CREATE POLICY "Invoices view" ON public.invoices FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 6. Update RLS for invoice_items
DROP POLICY IF EXISTS "Inv Items view" ON public.invoice_items;
CREATE POLICY "Inv Items view" ON public.invoice_items FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_items.invoice_id 
    AND i.client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);

-- 7. Update RLS for commercial_proposals
DROP POLICY IF EXISTS "CP view" ON public.commercial_proposals;
CREATE POLICY "CP view" ON public.commercial_proposals FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR created_by = auth.uid() OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 8. Update RLS for cp_items
DROP POLICY IF EXISTS "CP Items view" ON public.cp_items;
CREATE POLICY "CP Items view" ON public.cp_items FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  EXISTS (
    SELECT 1 FROM commercial_proposals cp 
    WHERE cp.id = cp_items.cp_id 
    AND cp.client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);


-- ==========================================
-- FILE: db_client_auth.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_fix_recursion.sql
-- ==========================================

-- db_fix_recursion.sql

BEGIN;

-- 1. Fix Objects view policy
-- The problem: Objects view checks Tasks, and Tasks view checks Objects.
-- Solution: Break the cycle. Objects can check tasks directly without triggering the Tasks view policy
-- by using a direct table reference or simplifying the check.

DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid()) OR
  id IN (SELECT object_id FROM tasks WHERE assigned_to = auth.uid())
);

-- 2. Fix Tasks view policy
-- We use a similar approach to avoid circular references.
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  object_id IN (
    SELECT id FROM objects 
    WHERE client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);

COMMIT;


-- ==========================================
-- FILE: db_fix_recursion_v2.sql
-- ==========================================

-- db_fix_recursion_v2.sql

BEGIN;

-- 1. Create SECURITY DEFINER functions to bypass RLS during policy checks
-- This prevents the infinite recursion between objects and tasks policies.

CREATE OR REPLACE FUNCTION public.has_object_task(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.tasks WHERE object_id = obj_id AND assigned_to = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_client_object(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.objects o
    JOIN public.profiles p ON p.client_id = o.client_id
    WHERE o.id = obj_id AND p.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Objects view
DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid()) OR
  public.has_object_task(id, auth.uid())
);

-- 3. Update Tasks view
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  public.is_client_object(object_id, auth.uid())
);

COMMIT;


-- ==========================================
-- FILE: db_fix_registration.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_fix_registration_v13.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_fix_registration_v14.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_fix_client_registration.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_admin_delete_user.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_admin_manage_user.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_fix_role_cast.sql
-- ==========================================

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


-- ==========================================
-- FILE: db_admin_functions.sql
-- ==========================================

-- Function to allow admins to update user credentials
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


-- ==========================================
-- FILE: db_add_telegram_chat_id.sql
-- ==========================================

-- Add telegram_chat_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Add comment
COMMENT ON COLUMN profiles.telegram_chat_id IS 'Telegram Chat ID for notifications';


