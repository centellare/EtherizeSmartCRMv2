
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V3 = `
-- SmartHome CRM v3.1: Динамические комплекты в документах

BEGIN;

-- 1. Добавляем иерархию в позиции КП
ALTER TABLE public.cp_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.cp_items(id) ON DELETE CASCADE;

-- 2. Добавляем иерархию в позиции Счетов
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.invoice_items(id) ON DELETE CASCADE;

-- 3. Индексы для скорости (опционально, но полезно)
CREATE INDEX IF NOT EXISTS idx_cp_items_parent ON public.cp_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_parent ON public.invoice_items(parent_id);

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
### ВАЖНО: Обновление базы данных (Версия 3.1)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это добавит возможность создавать комплекты ("папки") прямо внутри КП и Счетов.
`;
