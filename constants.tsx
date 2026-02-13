
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v2.8: Расширение карточки товара (Импорт)

BEGIN;

-- 1. Добавляем поля в таблицу products для соответствия реальному прайс-листу
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS manufacturer TEXT, -- Поставщик/Производитель
ADD COLUMN IF NOT EXISTS origin_country TEXT, -- Страна происхождения
ADD COLUMN IF NOT EXISTS weight NUMERIC; -- Вес, КГ

-- 2. Обновляем view или кэши (если есть, здесь просто для примера)
COMMENT ON COLUMN public.products.manufacturer IS 'Производитель или Поставщик';

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
        { name: 'weight', type: 'numeric', description: 'Вес (кг)' }
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
### ВАЖНО: Обновление базы данных (Версия 2.8)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это добавит поля "Производитель", "Страна" и "Вес" в товары.
`;
