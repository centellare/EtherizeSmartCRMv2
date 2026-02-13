
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v2.6: Маркетинг и Рефералы + Исправления

BEGIN;

-- 1. [NEW] Маркетинг и Рефералы (Клиенты)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.clients(id);

-- 2. СБРОС И ОБНОВЛЕНИЕ ПРАВ ДОСТУПА (RLS) ДЛЯ ЗАДАЧ
DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.tasks;

CREATE POLICY "Tasks update policy" ON public.tasks
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR
  auth.uid() = assigned_to
  OR
  auth.uid() = created_by
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR
  auth.uid() = assigned_to
  OR
  auth.uid() = created_by
);

-- 3. Гарантируем наличие полей (безопасно, если уже есть)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

-- 4. Функция для быстрой аналитики (на будущее)
CREATE OR REPLACE FUNCTION get_finance_analytics(year_input int)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  start_balance decimal;
  monthly_data json;
BEGIN
  -- 1. Calculate Balance at start of year
  SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN COALESCE(fact_amount, 0) ELSE -amount END), 0)
  INTO start_balance
  FROM transactions
  WHERE extract(year from created_at) < year_input
  AND deleted_at IS NULL
  AND (status = 'approved' OR type = 'income');

  -- 2. Calculate Monthly Stats
  SELECT json_agg(t) INTO monthly_data FROM (
    SELECT
      extract(month from created_at) as month,
      SUM(CASE WHEN type = 'income' THEN COALESCE(fact_amount, 0) ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE extract(year from created_at) = year_input
    AND deleted_at IS NULL
    AND (status = 'approved' OR type = 'income')
    GROUP BY 1
  ) t;

  RETURN json_build_object(
    'start_balance', start_balance,
    'months', COALESCE(monthly_data, '[]'::json)
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'tasks',
    description: 'Задачи (обновление прав)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'completed_by', type: 'uuid', description: 'Кто завершил', references: 'profiles' }
    ]
  },
  {
    name: 'products',
    description: 'Номенклатура',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'image_url', type: 'text', description: 'Ссылка на фото товара' }
    ]
  },
  {
    name: 'commercial_proposals',
    description: 'Коммерческие предложения',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'object_id', type: 'uuid', description: 'Привязка к объекту', references: 'objects' }
    ]
  },
  {
    name: 'clients',
    description: 'Клиенты (Маркетинг)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'lead_source', type: 'text', description: 'Источник (Instagram, Партнер...)' },
        { name: 'referred_by', type: 'uuid', description: 'Кто порекомендовал (ID клиента)', references: 'clients' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### ВАЖНО: Обновление базы данных (Версия 2.6)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это добавит отслеживание источников клиентов, реферальную систему и исправит права доступа.
`;
