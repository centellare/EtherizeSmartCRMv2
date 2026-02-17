
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V10 = `
-- SmartHome CRM v10.0: FINAL FIX (Ambiguity & Finances)
-- 1. Решает проблему "ambiguous function" путем создания версии v2.
-- 2. Открывает права на создание расходов для специалистов.

BEGIN;

-------------------------------------------------------------------------------
-- 1. УТИЛИТЫ ПРОВЕРКИ ПРАВ
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_manager_role()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'director', 'manager', 'storekeeper')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-------------------------------------------------------------------------------
-- 2. ФИНАНСЫ (TRANSACTIONS) - ПЕРЕЗАПИСЬ ПРАВ
-------------------------------------------------------------------------------
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance Select Logic" ON transactions;
DROP POLICY IF EXISTS "Finance Insert Logic" ON transactions;
DROP POLICY IF EXISTS "Finance Update Privileged" ON transactions;
DROP POLICY IF EXISTS "Finance Delete Admin" ON transactions;

-- Чтение: Руководство видит всё, Специалист - только свои записи
CREATE POLICY "Finance_Read" ON transactions FOR SELECT TO authenticated 
USING (public.is_manager_role() OR created_by = auth.uid());

-- Вставка: Разрешена ВСЕМ авторизованным (подать заявку на расход)
CREATE POLICY "Finance_Create" ON transactions FOR INSERT TO authenticated 
WITH CHECK (true);

-- Обновление: Только руководство (утверждение статуса)
CREATE POLICY "Finance_Update" ON transactions FOR UPDATE TO authenticated 
USING (public.is_manager_role());

-- Удаление: Только руководство
CREATE POLICY "Finance_Delete" ON transactions FOR DELETE TO authenticated 
USING (public.is_manager_role());

-------------------------------------------------------------------------------
-- 3. ЗАДАЧИ - НОВАЯ ФУНКЦИЯ (V2)
-- Используем уникальное имя, чтобы Postgres не путался в старых версиях
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_task_v2(
  p_object_id uuid,
  p_title text,
  p_assigned_to uuid,
  p_start_date text, -- Принимаем как текст для надежности, внутри кастим
  p_deadline text,
  p_comment text,
  p_doc_link text,
  p_doc_name text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Выполняем с правами админа, чтобы обойти любые RLS на чтение этапов
SET search_path = public
AS $$
DECLARE
  v_stage_id text;
  v_task_id uuid;
  v_start_ts timestamp with time zone;
  v_dead_ts timestamp with time zone;
BEGIN
  -- Безопасный кастинг дат
  BEGIN
    v_start_ts := p_start_date::timestamp with time zone;
  EXCEPTION WHEN OTHERS THEN
    v_start_ts := now();
  END;

  IF p_deadline IS NOT NULL AND p_deadline != '' THEN
    BEGIN
      v_dead_ts := p_deadline::timestamp with time zone;
    EXCEPTION WHEN OTHERS THEN
      v_dead_ts := null;
    END;
  ELSE
    v_dead_ts := null;
  END IF;

  -- Получаем этап (игнорируя ошибки доступа)
  BEGIN
    SELECT current_stage INTO v_stage_id FROM objects WHERE id = p_object_id;
  EXCEPTION WHEN OTHERS THEN
    v_stage_id := NULL;
  END;

  INSERT INTO tasks (
    object_id, title, assigned_to, start_date, deadline, 
    comment, doc_link, doc_name, created_by, stage_id, status, is_deleted
  ) VALUES (
    p_object_id, p_title, p_assigned_to, v_start_ts, v_dead_ts,
    p_comment, p_doc_link, p_doc_name, p_user_id, v_stage_id, 'pending', false
  ) RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$;

-------------------------------------------------------------------------------
-- 4. СКЛАД (INVENTORY) - ПРАВА
-------------------------------------------------------------------------------
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inventory_Read" ON inventory_items;
DROP POLICY IF EXISTS "Inventory_Write" ON inventory_items;

-- Читать склад могут все
CREATE POLICY "Inventory_Read" ON inventory_items FOR SELECT TO authenticated USING (true);

-- Менять склад может только руководство и кладовщик (storekeeper включен в is_manager_role)
CREATE POLICY "Inventory_Write" ON inventory_items FOR ALL TO authenticated 
USING (public.is_manager_role())
WITH CHECK (public.is_manager_role());

COMMIT;
`;

export const MIGRATION_SQL_V9 = MIGRATION_SQL_V10;
export const MIGRATION_SQL_V8 = MIGRATION_SQL_V10;
export const MIGRATION_SQL_V7 = MIGRATION_SQL_V10;
export const MIGRATION_SQL_V6 = MIGRATION_SQL_V10;
export const MIGRATION_SQL_V5 = MIGRATION_SQL_V10;

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
  }
];

export const SUPABASE_SETUP_GUIDE = `
### ВАЖНО: Финальное обновление (Версия 10.0)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это исправит ошибку "ambiguous function" при создании задач и настроит права для финансов и склада.
`;
