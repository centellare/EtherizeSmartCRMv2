
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V5 = `
-- SmartHome CRM v5.0: Исправление связей истории

BEGIN;

-- 1. Добавляем внешний ключ к таблице истории, если его нет
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'object_history_profile_id_fkey') THEN 
    ALTER TABLE "public"."object_history" 
    ADD CONSTRAINT "object_history_profile_id_fkey" 
    FOREIGN KEY ("profile_id") 
    REFERENCES "public"."profiles"("id"); 
  END IF; 
END $$;

-- 2. Убеждаемся, что RLS включен (повтор V4 на всякий случай)
ALTER TABLE "public"."object_history" ENABLE ROW LEVEL SECURITY;

-- 3. Политики доступа
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."object_history";
CREATE POLICY "Enable read access for authenticated users" ON "public"."object_history" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON "public"."object_history";
CREATE POLICY "Enable insert for users based on user_id" ON "public"."object_history" FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);

COMMIT;
`;

// Keep V4 for reference or legacy, but UI will point to V5
export const MIGRATION_SQL_V4 = MIGRATION_SQL_V5;

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
### ВАЖНО: Обновление базы данных (Версия 5.0)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это исправит отображение заметок в хронологии и настроит права доступа.
`;
