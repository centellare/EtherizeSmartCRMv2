
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.2 Migration (Project Fixes)

BEGIN;

-- 1. Связь Счета с Объектом (Критично для снабжения)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

-- 2. Связь Транзакции со Счетом (Для синхронизации финансов)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);

-- 3. Обновление индексов
CREATE INDEX IF NOT EXISTS idx_invoices_object ON public.invoices(object_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON public.transactions(invoice_id);

-- 4. Функция для разделения позиции заказа (Частичная приемка)
-- (Логика будет на клиенте, но SQL полезен для консистентности, пока оставим пустым)

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'invoices',
    description: 'Счета',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'object_id', type: 'uuid', description: 'Привязка к объекту', references: 'objects' },
        { name: 'shipping_status', type: 'text', description: 'none | partial | shipped' }
    ]
  },
  {
    name: 'transactions',
    description: 'Финансы',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'invoice_id', type: 'uuid', description: 'Связь со счетом', references: 'invoices' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по обновлению (Версия 2.2)
1. Скопируйте SQL-скрипт.
2. Выполните его в SQL Editor панели Supabase.
3. Это исправит связи между Объектами, Счетами и Финансами.
`;
