
-- SmartHome CRM: FULL LOGIC RESET v6.3 (Comprehensive RLS Fix)
-- Исправлены права доступа для КП, Счетов, Настроек и Снабжения.

BEGIN;

--------------------------------------------------------------------------------
-- 1. SMART CLEANUP (Динамическое удаление дубликатов)
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
-- 2. DATA TYPE FIXES (Исправление типов колонок)
--------------------------------------------------------------------------------

-- ВАЖНО: Удаляем зависимые колонки перед сменой типа, чтобы избежать ошибки 0A000
ALTER TABLE public.products DROP COLUMN IF EXISTS markup_percent;

-- Приводим денежные и количественные поля к numeric
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

ALTER TABLE public.cp_items ALTER COLUMN price_at_moment TYPE numeric USING price_at_moment::numeric;
ALTER TABLE public.cp_items ALTER COLUMN final_price_byn TYPE numeric USING final_price_byn::numeric;
ALTER TABLE public.cp_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Восстанавливаем markup_percent как обычную колонку (не generated), чтобы её можно было менять
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 0;

-- Пересчитываем markup_percent на основе текущих цен (чтобы данные не пропали)
UPDATE public.products 
SET markup_percent = CASE 
    WHEN base_price > 0 THEN ROUND(((retail_price - base_price) / base_price) * 100, 2)
    ELSE 0 
END;

--------------------------------------------------------------------------------
-- 3. CORE FUNCTIONS (Бизнес-логика)
--------------------------------------------------------------------------------

-- Вспомогательная функция для получения роли текущего пользователя
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.1 Безопасное создание задачи (RPC)
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
    -- Определяем текущий этап объекта
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

-- 3.2 Переход этапа
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

    -- 1. Закрываем текущий этап
    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now() 
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    -- 2. Создаем новый этап
    INSERT INTO public.object_stages (
        object_id, stage_name, status, started_at, responsible_id, deadline
    ) VALUES (
        p_object_id, p_next_stage, 'active', now(), p_responsible_id, p_deadline
    );

    -- 3. Обновляем объект
    UPDATE public.objects 
    SET current_stage = p_next_stage, 
        responsible_id = p_responsible_id,
        current_status = 'in_work',
        updated_at = now(),
        updated_by = p_user_id
    WHERE id = p_object_id;

    -- 4. Пишем историю
    INSERT INTO public.object_history (object_id, profile_id, action_text)
    VALUES (p_object_id, p_user_id, 'Переход на этап: ' || p_next_stage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 Откат этапа
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

    -- Помечаем текущий как отмененный/откаченный
    UPDATE public.object_stages 
    SET status = 'rolled_back', completed_at = now()
    WHERE object_id = p_object_id AND stage_name = v_current_stage AND status = 'active';

    -- Активируем целевой (старый) этап заново или создаем запись о возврате
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

-- 3.4 Восстановление этапа (прыжок вперед после отката)
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

    -- Закрываем текущий "исправленный" этап
    UPDATE public.object_stages 
    SET status = 'completed', completed_at = now()
    WHERE object_id = p_object_id AND status = 'active';

    -- Восстанавливаем тот, откуда пришли
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

-- 3.5 Завершение проекта
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

-- 3.6 Auth Trigger (New User)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'specialist')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--------------------------------------------------------------------------------
-- 4. RLS POLICIES (Права доступа)
--------------------------------------------------------------------------------

-- Включаем RLS на всех таблицах
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- IMPORTANT: Enable RLS on new tables
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

-- 4.5 INVENTORY & PRODUCTS
CREATE POLICY "Inventory view" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Products view" ON public.products FOR SELECT USING (true);
CREATE POLICY "Inventory manage" ON public.inventory_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);
CREATE POLICY "Products manage" ON public.products FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

-- 4.6 CLIENTS
CREATE POLICY "Clients view" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Clients manage" ON public.clients FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'manager')
);

-- 4.7 COMMERCIAL PROPOSALS (КП) & ITEMS
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

-- 4.8 INVOICES (Счета) & ITEMS
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

-- 4.9 SUPPLY ORDERS (Снабжение)
CREATE POLICY "Supply view" ON public.supply_orders FOR SELECT USING (true);
CREATE POLICY "Supply manage" ON public.supply_orders FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

CREATE POLICY "Supply Items view" ON public.supply_order_items FOR SELECT USING (true);
CREATE POLICY "Supply Items manage" ON public.supply_order_items FOR ALL USING (
  get_my_role() IN ('admin', 'director', 'storekeeper', 'manager')
);

-- 4.10 SETTINGS & TEMPLATES
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

-- 4.11 UTILS (Connections, Notifications, History)
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
