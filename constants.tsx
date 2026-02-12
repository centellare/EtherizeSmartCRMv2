
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.4 Migration (CP Links & Settings)

BEGIN;

-- 1. Добавляем поле картинки в товары
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Связь Счета с Объектом
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

-- 3. Связь Транзакции со Счетом
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

-- 4. Связь КП с Объектом
ALTER TABLE public.commercial_proposals 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

-- 5. Логотип компании
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 6. Обновление индексов
CREATE INDEX IF NOT EXISTS idx_invoices_object ON public.invoices(object_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cp_object ON public.commercial_proposals(object_id);

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
    name: 'commercial_proposals',
    description: 'Коммерческие предложения',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'object_id', type: 'uuid', description: 'Привязка к объекту', references: 'objects' }
    ]
  },
  {
    name: 'company_settings',
    description: 'Настройки компании',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'logo_url', type: 'text', description: 'URL логотипа' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по обновлению (Версия 2.4)
1. Скопируйте SQL-скрипт.
2. Выполните его в SQL Editor панели Supabase.
3. Это добавит связи объектов с КП и поле для логотипа.
`;
