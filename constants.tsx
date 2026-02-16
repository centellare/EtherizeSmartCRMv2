
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v3.4: Исправление ошибки "Ambiguous function"

BEGIN;

-- 1. УДАЛЕНИЕ ДУБЛИКАТОВ ФУНКЦИЙ
-- Удаляем все возможные вариации, чтобы избежать конфликтов типов
DROP FUNCTION IF EXISTS public.transition_object_stage(uuid, text, uuid, date, uuid);
DROP FUNCTION IF EXISTS public.transition_object_stage(uuid, text, uuid, timestamp, uuid);
DROP FUNCTION IF EXISTS public.transition_object_stage(uuid, text, uuid, timestamptz, uuid);

DROP FUNCTION IF EXISTS public.rollback_object_stage(uuid, text, text, uuid, uuid);

DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, text, date, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, text, timestamp, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, text, timestamptz, text, text, text, uuid);

-- 2. СОЗДАНИЕ ПРАВИЛЬНЫХ ФУНКЦИЙ (SECURITY DEFINER)

-- Функция перехода на следующий этап
CREATE OR REPLACE FUNCTION public.transition_object_stage(
  p_object_id uuid,
  p_next_stage text,
  p_responsible_id uuid,
  p_deadline timestamptz, -- Используем timestamptz как стандарт
  p_user_id uuid
) 
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- Закрываем текущий активный этап
  UPDATE public.object_stages
  SET status = 'completed', completed_at = now()
  WHERE object_id = p_object_id AND status = 'active';

  -- Обновляем сам объект
  UPDATE public.objects
  SET current_stage = p_next_stage,
      responsible_id = p_responsible_id,
      updated_at = now(),
      updated_by = p_user_id
  WHERE id = p_object_id;

  -- Создаем запись нового этапа
  INSERT INTO public.object_stages (object_id, stage_name, status, responsible_id, deadline, started_at)
  VALUES (p_object_id, p_next_stage, 'active', p_responsible_id, p_deadline, now());

  -- История
  INSERT INTO public.object_history (object_id, profile_id, action_text)
  VALUES (p_object_id, p_user_id, 'Переход на этап: ' || p_next_stage);
END;
$$;

-- Функция возврата этапа
CREATE OR REPLACE FUNCTION public.rollback_object_stage(
  p_object_id uuid,
  p_target_stage text,
  p_reason text,
  p_responsible_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_stage text;
BEGIN
  SELECT current_stage INTO v_old_stage FROM public.objects WHERE id = p_object_id;

  UPDATE public.object_stages
  SET status = 'rolled_back', completed_at = now()
  WHERE object_id = p_object_id AND status = 'active';

  UPDATE public.objects
  SET current_stage = p_target_stage,
      responsible_id = p_responsible_id,
      rolled_back_from = v_old_stage,
      current_status = 'in_work',
      updated_at = now(),
      updated_by = p_user_id
  WHERE id = p_object_id;

  INSERT INTO public.object_stages (object_id, stage_name, status, responsible_id, started_at)
  VALUES (p_object_id, p_target_stage, 'active', p_responsible_id, now());

  INSERT INTO public.object_history (object_id, profile_id, action_text)
  VALUES (p_object_id, p_user_id, 'Возврат на этап: ' || p_target_stage || '. Причина: ' || p_reason);
END;
$$;

-- Функция завершения проекта
CREATE OR REPLACE FUNCTION public.finalize_project(
  p_object_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.object_stages
  SET status = 'completed', completed_at = now()
  WHERE object_id = p_object_id AND status = 'active';

  UPDATE public.objects
  SET current_status = 'completed',
      updated_at = now(),
      updated_by = p_user_id
  WHERE id = p_object_id;
  
  INSERT INTO public.object_history (object_id, profile_id, action_text)
  VALUES (p_object_id, p_user_id, 'Проект успешно завершен');
END;
$$;

-- Функция безопасного создания задач (через RPC)
CREATE OR REPLACE FUNCTION public.create_task_safe(
  p_object_id uuid,
  p_title text,
  p_assigned_to uuid,
  p_start_date date,
  p_deadline timestamptz,
  p_comment text,
  p_doc_link text,
  p_doc_name text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stage text;
BEGIN
  -- Авто-определение текущего этапа
  SELECT current_stage INTO v_stage FROM public.objects WHERE id = p_object_id;

  INSERT INTO public.tasks (
    object_id, stage_id, title, assigned_to, start_date, deadline, 
    comment, doc_link, doc_name, created_by, status
  ) VALUES (
    p_object_id, v_stage, p_title, p_assigned_to, p_start_date, p_deadline, 
    p_comment, p_doc_link, p_doc_name, p_user_id, 'pending'
  );
END;
$$;

COMMIT;
`;

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
### ВАЖНО: Обновление базы данных (Версия 3.4)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это удалит дубликаты системных функций, вызывающие ошибку "Could not choose the best candidate function".
`;
