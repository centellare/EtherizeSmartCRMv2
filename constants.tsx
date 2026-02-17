
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V6 = `
-- SmartHome CRM v6.0: Исправление структуры для КП и Счетов
-- Добавляем поддержку вложенности (комплектов) и исправляем типы

BEGIN;

-- 1. Исправление cp_items (Позиции КП)
-- Добавляем parent_id если его нет
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cp_items' AND column_name='parent_id') THEN 
    ALTER TABLE "public"."cp_items" ADD COLUMN "parent_id" uuid REFERENCES "public"."cp_items"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Убеждаемся, что цены numeric
ALTER TABLE "public"."cp_items" 
  ALTER COLUMN "final_price_byn" TYPE numeric USING final_price_byn::numeric,
  ALTER COLUMN "price_at_moment" TYPE numeric USING price_at_moment::numeric,
  ALTER COLUMN "quantity" TYPE numeric USING quantity::numeric;


-- 2. Исправление invoice_items (Позиции Счета)
-- Добавляем parent_id если его нет
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='parent_id') THEN 
    ALTER TABLE "public"."invoice_items" ADD COLUMN "parent_id" uuid REFERENCES "public"."invoice_items"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Убеждаемся, что цены numeric
ALTER TABLE "public"."invoice_items" 
  ALTER COLUMN "price" TYPE numeric USING price::numeric,
  ALTER COLUMN "total" TYPE numeric USING total::numeric,
  ALTER COLUMN "quantity" TYPE numeric USING quantity::numeric;

-- 3. Очистка "битых" записей (где ссылка на продукт есть, но продукта нет)
-- Опционально, но полезно для целостности
DELETE FROM "public"."cp_items" WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT id FROM "public"."products");
DELETE FROM "public"."invoice_items" WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT id FROM "public"."products");

COMMIT;
`;

export const MIGRATION_SQL_V5 = MIGRATION_SQL_V6; // Point latest to V6

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
### ВАЖНО: Обновление базы данных (Версия 6.0)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это исправит структуру таблиц для корректной работы КП и Счетов (вложенность, типы данных).
`;
