
import { TableSchema } from './types';

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'profiles',
    description: 'Профили сотрудников. Роли: admin, director, manager, specialist.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, description: 'ID пользователя (ссылка на auth.users)' },
      { name: 'full_name', type: 'text', description: 'ФИО' },
      { name: 'email', type: 'text', description: 'Email' },
      { name: 'role', type: 'text', defaultValue: "'specialist'", description: 'Роль: admin, director, manager, specialist' },
      { name: 'phone', type: 'text', isNullable: true, description: 'Телефон' },
      { name: 'birth_date', type: 'date', isNullable: true, description: 'Дата рождения' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true, description: 'Метка удаления' },
      { name: 'must_change_password', type: 'boolean', defaultValue: 'false', description: 'Флаг сброса пароля' }
    ]
  },
  {
    name: 'clients',
    description: 'База клиентов (Физлица и Юрлица).',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'type', type: 'text', description: 'Тип (person/company)' },
      { name: 'name', type: 'text', description: 'Имя / Наименование' },
      { name: 'contact_person', type: 'text', isNullable: true },
      { name: 'contact_position', type: 'text', isNullable: true },
      { name: 'phone', type: 'text', isNullable: true },
      { name: 'email', type: 'text', isNullable: true },
      { name: 'requisites', type: 'text', isNullable: true },
      { name: 'comment', type: 'text', isNullable: true },
      { name: 'manager_id', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' },
      { name: 'updated_at', type: 'timestamp', isNullable: true },
      { name: 'created_by', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'updated_by', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true }
    ]
  },
  {
    name: 'objects',
    description: 'Объекты (проекты) системы.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text', description: 'Название' },
      { name: 'address', type: 'text', isNullable: true },
      { name: 'current_stage', type: 'text', defaultValue: "'negotiation'" },
      { name: 'current_status', type: 'text', defaultValue: "'in_work'" },
      { name: 'client_id', type: 'uuid', isForeign: true, references: 'clients(id)' },
      { name: 'responsible_id', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'comment', type: 'text', isNullable: true },
      { name: 'rolled_back_from', type: 'text', isNullable: true },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'updated_at', type: 'timestamp', isNullable: true },
      { name: 'updated_by', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'is_deleted', type: 'boolean', defaultValue: 'false' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true }
    ]
  },
  {
    name: 'object_stages',
    description: 'История этапов объекта.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'object_id', type: 'uuid', isForeign: true, references: 'objects(id)' },
      { name: 'stage_name', type: 'text' },
      { name: 'status', type: 'text', defaultValue: "'active'" },
      { name: 'started_at', type: 'timestamp', defaultValue: 'now()' },
      { name: 'deadline', type: 'timestamp', isNullable: true },
      { name: 'completed_at', type: 'timestamp', isNullable: true },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'tasks',
    description: 'Задачи по объектам.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'object_id', type: 'uuid', isForeign: true, references: 'objects(id)' },
      { name: 'stage_id', type: 'text', isNullable: true },
      { name: 'title', type: 'text' },
      { name: 'assigned_to', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'start_date', type: 'date', defaultValue: 'now()' },
      { name: 'deadline', type: 'timestamp', isNullable: true },
      { name: 'status', type: 'text', defaultValue: "'pending'" },
      { name: 'comment', type: 'text', isNullable: true },
      { name: 'doc_link', type: 'text', isNullable: true },
      { name: 'doc_name', type: 'text', isNullable: true },
      { name: 'completion_comment', type: 'text', isNullable: true },
      { name: 'completion_doc_link', type: 'text', isNullable: true },
      { name: 'completion_doc_name', type: 'text', isNullable: true },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'completed_at', type: 'timestamp', isNullable: true },
      { name: 'last_edited_at', type: 'timestamp', isNullable: true },
      { name: 'last_edited_by', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'is_deleted', type: 'boolean', defaultValue: 'false' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true }
    ]
  },
  {
    name: 'task_checklists',
    description: 'Чек-листы внутри задач',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'task_id', type: 'uuid', isForeign: true, references: 'tasks(id)' },
      { name: 'content', type: 'text' },
      { name: 'is_completed', type: 'boolean', defaultValue: 'false' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'transactions',
    description: 'Финансовые операции',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'object_id', type: 'uuid', isForeign: true, references: 'objects(id)' },
      { name: 'type', type: 'text', description: 'income/expense' },
      { name: 'amount', type: 'numeric' },
      { name: 'planned_amount', type: 'numeric', isNullable: true },
      { name: 'requested_amount', type: 'numeric', isNullable: true },
      { name: 'fact_amount', type: 'numeric', defaultValue: '0' },
      { name: 'planned_date', type: 'date', isNullable: true },
      { name: 'status', type: 'text', defaultValue: "'pending'" },
      { name: 'category', type: 'text' },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'doc_link', type: 'text', isNullable: true },
      { name: 'doc_name', type: 'text', isNullable: true },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'processed_at', type: 'timestamp', isNullable: true },
      { name: 'processed_by', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'deleted_at', type: 'timestamp', isNullable: true }
    ]
  },
  {
    name: 'transaction_payments',
    description: 'Фактические платежи по транзакциям.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'transaction_id', type: 'uuid', isForeign: true, references: 'transactions(id)' },
      { name: 'amount', type: 'numeric' },
      { name: 'comment', type: 'text', isNullable: true },
      { name: 'payment_date', type: 'timestamp', defaultValue: 'now()' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'requires_doc', type: 'boolean', defaultValue: 'false' },
      { name: 'doc_type', type: 'text', isNullable: true },
      { name: 'doc_number', type: 'text', isNullable: true },
      { name: 'doc_date', type: 'date', isNullable: true }
    ]
  },
  {
    name: 'notifications',
    description: 'Системные уведомления',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'profile_id', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'content', type: 'text' },
      { name: 'is_read', type: 'boolean', defaultValue: 'false' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'inventory_catalog',
    description: 'Справочник номенклатуры товаров.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text', description: 'Название товара' },
      { name: 'item_type', type: 'text', defaultValue: "'product'", description: 'product / material' },
      { name: 'sku', type: 'text', isNullable: true, description: 'Артикул' },
      { name: 'unit', type: 'text', defaultValue: "'шт'", description: 'Ед. измерения' },
      { name: 'last_purchase_price', type: 'numeric', defaultValue: '0', description: 'Цена закупки' },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'has_serial', type: 'boolean', defaultValue: 'false', description: 'Требуется ли серийный номер' },
      { name: 'warranty_period_months', type: 'integer', defaultValue: '12', description: 'Гарантия (мес)' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'inventory_items',
    description: 'Единицы товара на складе и объектах.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'catalog_id', type: 'uuid', isForeign: true, references: 'inventory_catalog(id)' },
      { name: 'serial_number', type: 'text', isNullable: true },
      { name: 'quantity', type: 'numeric', defaultValue: '1', description: 'Количество' },
      { name: 'purchase_price', type: 'numeric', defaultValue: '0', description: 'Цена закупки партии' },
      { name: 'status', type: 'text', defaultValue: "'in_stock'", description: 'in_stock / deployed / scrapped' },
      { name: 'current_object_id', type: 'uuid', isNullable: true, isForeign: true, references: 'objects(id)' },
      { name: 'assigned_to_id', type: 'uuid', isNullable: true, isForeign: true, references: 'profiles(id)' },
      { name: 'warranty_start', type: 'date', isNullable: true },
      { name: 'warranty_end', type: 'date', isNullable: true },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'inventory_history',
    description: 'Журнал движения ТМЦ',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'item_id', type: 'uuid', isForeign: true, references: 'inventory_items(id)' },
      { name: 'action_type', type: 'text', description: 'receive, deploy, scrap, replace' },
      { name: 'from_object_id', type: 'uuid', isNullable: true },
      { name: 'to_object_id', type: 'uuid', isNullable: true },
      { name: 'comment', type: 'text', isNullable: true },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'price_catalog',
    description: 'Справочник цен и товаров (Прайс-лист)',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'global_category', type: 'text' },
      { name: 'item_type', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'unit', type: 'text', defaultValue: "'шт'" },
      { name: 'price_eur', type: 'numeric', defaultValue: '0' },
      { name: 'markup_percent', type: 'numeric', defaultValue: '0' },
      { name: 'is_active', type: 'boolean', defaultValue: 'true' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'commercial_proposals',
    description: 'Коммерческие предложения (Шапка)',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'number', type: 'serial', description: 'Авто-номер' },
      { name: 'title', type: 'text', isNullable: true, description: 'Название проекта' },
      { name: 'client_id', type: 'uuid', isForeign: true, references: 'clients(id)' },
      { name: 'status', type: 'text', defaultValue: "'draft'" },
      { name: 'exchange_rate', type: 'numeric' },
      { name: 'global_markup', type: 'numeric', defaultValue: '0' },
      { name: 'has_vat', type: 'boolean', defaultValue: 'false' },
      { name: 'total_amount_byn', type: 'numeric' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  },
  {
    name: 'cp_items',
    description: 'Позиции в КП с snapshot-данными',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'cp_id', type: 'uuid', isForeign: true, references: 'commercial_proposals(id)' },
      { name: 'catalog_id', type: 'uuid', isForeign: true, references: 'price_catalog(id)' },
      { name: 'quantity', type: 'integer', defaultValue: '1' },
      { name: 'final_price_byn', type: 'numeric' },
      { name: 'snapshot_name', type: 'text', description: 'Копия названия на момент создания' },
      { name: 'snapshot_description', type: 'text', isNullable: true },
      { name: 'snapshot_unit', type: 'text', description: 'Копия ед.изм.' },
      { name: 'snapshot_base_price_eur', type: 'numeric', description: 'Базовая цена в евро на момент создания' },
      { name: 'snapshot_global_category', type: 'text', description: 'Категория на момент создания' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Необходимые SQL-функции (RPC) и Индексы
Для работы бизнес-логики приложения выполните следующий код в SQL Editor Supabase:

\`\`\`sql
-- МИГРАЦИЯ: Исправление структуры таблицы object_stages (Добавляем created_at, если нет)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'object_stages' AND column_name = 'created_at') THEN 
    ALTER TABLE public.object_stages ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(); 
  END IF; 
END $$;

-- МИГРАЦИЯ: Удаление ограничивающего уникального индекса (если есть), мешающего возврату на этап
ALTER TABLE public.object_stages DROP CONSTRAINT IF EXISTS object_stages_object_id_stage_name_key;
DROP INDEX IF EXISTS object_stages_object_id_stage_name_key;

-- МИГРАЦИЯ: Удаление старых версий функции для обновления сигнатуры
DROP FUNCTION IF EXISTS public.rollback_object_stage(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.rollback_object_stage(UUID, TEXT, TEXT, UUID, UUID);

-- 0. ОПТИМИЗАЦИЯ: Индексы
CREATE INDEX IF NOT EXISTS idx_objects_deleted ON public.objects(is_deleted);
CREATE INDEX IF NOT EXISTS idx_objects_status ON public.objects(current_status);
CREATE INDEX IF NOT EXISTS idx_objects_responsible ON public.objects(responsible_id);

CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON public.tasks(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_object_id ON public.tasks(object_id);

CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON public.transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_object ON public.transactions(object_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_serial ON public.inventory_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_object ON public.inventory_items(current_object_id);

-- 1. Переход на следующий этап объекта
CREATE OR REPLACE FUNCTION public.transition_object_stage(
  p_object_id UUID,
  p_next_stage TEXT,
  p_responsible_id UUID,
  p_deadline TIMESTAMP,
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Обновляем объект
  UPDATE public.objects
  SET current_stage = p_next_stage,
      responsible_id = COALESCE(p_responsible_id, responsible_id),
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_object_id;

  -- Записываем историю этапов
  UPDATE public.object_stages 
  SET status = 'completed', completed_at = NOW() 
  WHERE object_id = p_object_id AND status = 'active';

  INSERT INTO public.object_stages (object_id, stage_name, status, started_at, deadline, created_at)
  VALUES (p_object_id, p_next_stage, 'active', NOW(), p_deadline, NOW());

  -- Создаем уведомление новому ответственному
  IF p_responsible_id IS NOT NULL THEN
    INSERT INTO public.notifications (profile_id, content, created_at)
    VALUES (p_responsible_id, 'Вам передан объект на этапе ' || p_next_stage, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Откат этапа назад (ОБНОВЛЕНО: Исправлено закрытие текущего этапа)
CREATE OR REPLACE FUNCTION public.rollback_object_stage(
  p_object_id UUID,
  p_target_stage TEXT,
  p_reason TEXT,
  p_responsible_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_current_stage TEXT;
BEGIN
  SELECT current_stage INTO v_current_stage FROM public.objects WHERE id = p_object_id;

  -- Закрываем текущий активный этап (с которого уходим) как прерванный
  UPDATE public.object_stages 
  SET status = 'interrupted', completed_at = NOW() 
  WHERE object_id = p_object_id AND status = 'active';

  -- Обновляем объект
  UPDATE public.objects
  SET current_stage = p_target_stage,
      rolled_back_from = v_current_stage,
      current_status = 'in_work',
      responsible_id = p_responsible_id,
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_object_id;

  -- Вставляем новую запись в историю для этапа, на который вернулись
  INSERT INTO public.object_stages (object_id, stage_name, status, started_at, created_at)
  VALUES (p_object_id, p_target_stage, 'rolled_back', NOW(), NOW());
  
  -- Уведомление об откате
  INSERT INTO public.notifications (profile_id, content, created_at)
  VALUES (p_responsible_id, 'Объект возвращен вам на доработку. Причина: ' || p_reason, NOW());
END;
$$ LANGUAGE plpgsql;

-- 3. Безопасное создание задачи
CREATE OR REPLACE FUNCTION public.create_task_safe(
  p_object_id UUID,
  p_title TEXT,
  p_assigned_to UUID,
  p_start_date DATE,
  p_deadline TIMESTAMP,
  p_comment TEXT,
  p_doc_link TEXT,
  p_doc_name TEXT,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_stage_id TEXT;
BEGIN
  SELECT current_stage INTO v_stage_id FROM public.objects WHERE id = p_object_id;

  INSERT INTO public.tasks (
    object_id, stage_id, title, assigned_to, start_date, deadline, 
    comment, doc_link, doc_name, created_by, status
  ) VALUES (
    p_object_id, v_stage_id, p_title, p_assigned_to, p_start_date, p_deadline,
    p_comment, p_doc_link, p_doc_name, p_user_id, 'pending'
  );

  INSERT INTO public.notifications (profile_id, content, created_at)
  VALUES (p_assigned_to, 'Вам назначена новая задача: ' || p_title, NOW());
END;
$$ LANGUAGE plpgsql;

-- 4. Завершение проекта
CREATE OR REPLACE FUNCTION public.finalize_project(
  p_object_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.objects
  SET current_status = 'completed',
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = p_object_id;

  UPDATE public.object_stages 
  SET status = 'completed', completed_at = NOW() 
  WHERE object_id = p_object_id AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 5. RLS (Row Level Security)
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_items ENABLE ROW LEVEL SECURITY;

-- Политики для commercial_proposals
CREATE POLICY "Enable read access for all users" ON "public"."commercial_proposals"
AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "public"."commercial_proposals"
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for owners and admins" ON "public"."commercial_proposals"
AS PERMISSIVE FOR UPDATE TO authenticated USING (
  (auth.uid() = created_by) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')))
);

CREATE POLICY "Enable delete for owners and admins" ON "public"."commercial_proposals"
AS PERMISSIVE FOR DELETE TO authenticated USING (
  (auth.uid() = created_by) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')))
);

-- Политики для cp_items
CREATE POLICY "Enable read access for all users" ON "public"."cp_items"
AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "public"."cp_items"
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable delete for owners and admins" ON "public"."cp_items"
AS PERMISSIVE FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM commercial_proposals 
    WHERE commercial_proposals.id = cp_items.cp_id 
    AND (commercial_proposals.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')))
  )
);
\`\`\`
`;
