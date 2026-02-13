
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v3.0: Каскадное ценообразование

BEGIN;

-- 1. Добавляем глобальную наценку в настройки компании
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS global_markup NUMERIC DEFAULT 15;

-- 2. Создаем таблицу для правил категорий (поправки)
CREATE TABLE IF NOT EXISTS public.price_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category_name TEXT NOT NULL,
    markup_delta NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_name)
);

-- 3. Комментарии для ясности
COMMENT ON COLUMN public.products.markup_percent IS 'Индивидуальная поправка к наценке (дельта)';
COMMENT ON COLUMN public.company_settings.global_markup IS 'Базовая наценка компании (в процентах)';

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
### ВАЖНО: Обновление базы данных (Версия 3.0)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это добавит поддержку каскадных наценок (Общая -> Категория -> Товар).
`;
