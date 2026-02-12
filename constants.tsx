
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.3 Migration (Images & Invoices)

BEGIN;

-- 1. Добавляем поле картинки в товары
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Связь Счета с Объектом (Критично для снабжения)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

-- 3. Связь Транзакции со Счетом (Для синхронизации финансов)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

-- 4. Обновление индексов
CREATE INDEX IF NOT EXISTS idx_invoices_object ON public.invoices(object_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON public.transactions(invoice_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'products',
    description: 'Номенклатура',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'image_url', type: 'text', description: 'Ссылка на фото товара' }
    ]
  },
  {
    name: 'invoices',
    description: 'Счета',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'object_id', type: 'uuid', description: 'Привязка к объекту', references: 'objects' },
        { name: 'shipping_status', type: 'text', description: 'none | partial | shipped' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по обновлению (Версия 2.3)
1. Скопируйте SQL-скрипт.
2. Выполните его в SQL Editor панели Supabase.
3. Это добавит поддержку изображений товаров и связи со счетами.
`;