
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v3.2: Исправление прав доступа (RLS)

BEGIN;

-- 1. ОБЪЕКТЫ: Разрешаем Менеджерам редактировать ТОЛЬКО свои объекты
DROP POLICY IF EXISTS "Objects Update Policy" ON public.objects;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.objects;

CREATE POLICY "Objects Update Policy" ON public.objects
FOR UPDATE USING (
  (auth.uid() = responsible_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')))
);

-- 2. ЭТАПЫ (Object Stages): Разрешаем ответственным двигать этапы
ALTER TABLE public.object_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stages Insert Policy" ON public.object_stages;
CREATE POLICY "Stages Insert Policy" ON public.object_stages
FOR INSERT WITH CHECK (
  -- Можно создавать, если ты админ/директор ИЛИ ответственный за объект
  EXISTS (
    SELECT 1 FROM objects 
    WHERE id = object_stages.object_id 
    AND (responsible_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director'))
  )
);

DROP POLICY IF EXISTS "Stages Update Policy" ON public.object_stages;
CREATE POLICY "Stages Update Policy" ON public.object_stages
FOR UPDATE USING (
   EXISTS (
    SELECT 1 FROM objects 
    WHERE id = object_stages.object_id 
    AND (responsible_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director'))
  )
);

-- 3. ЗАДАЧИ: Все видят всё, но редактируют только свое
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tasks;
CREATE POLICY "Tasks View All" ON public.tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update for users based on email" ON public.tasks;
CREATE POLICY "Tasks Edit Own" ON public.tasks
FOR UPDATE USING (
  (auth.uid() = assigned_to) OR 
  (auth.uid() = created_by) OR
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')))
);

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
### ВАЖНО: Обновление базы данных (Версия 3.2)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это исправит ошибки доступа "Permission denied" для менеджеров и специалистов.
`;
