
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.0 Migration Script
-- Добавляет таблицы для Счетов, Шаблонов и Заказов поставщику.

BEGIN;

-- 1. Настройки и Шаблоны документов
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'cp' or 'invoice'
    header_text TEXT,
    footer_text TEXT,
    signatory_1 TEXT DEFAULT 'Генеральный директор',
    signatory_2 TEXT DEFAULT 'Главный бухгалтер',
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставляем дефолтные шаблоны, если нет
INSERT INTO public.document_templates (type, header_text, footer_text)
SELECT 'cp', 'Мы рады предложить вам следующее решение...', 'Предложение действительно 5 дней.'
WHERE NOT EXISTS (SELECT 1 FROM public.document_templates WHERE type = 'cp');

INSERT INTO public.document_templates (type, header_text, footer_text)
SELECT 'invoice', 'Внимание! Оплата данного счета означает согласие с условиями поставки товара.', 'Товар отпускается по факту прихода денег.'
WHERE NOT EXISTS (SELECT 1 FROM public.document_templates WHERE type = 'invoice');


-- 2. Счета (Invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number SERIAL,
    cp_id UUID REFERENCES public.commercial_proposals(id),
    client_id UUID REFERENCES public.clients(id),
    total_amount NUMERIC DEFAULT 0,
    has_vat BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'draft', -- draft, sent, paid, cancelled
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit TEXT DEFAULT 'шт',
    price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0
);

-- 3. Заказы поставщикам (Supply Orders) - Дефицит
CREATE TABLE IF NOT EXISTS public.supply_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id),
    status TEXT DEFAULT 'pending', -- pending, ordered, received
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supply_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_order_id UUID REFERENCES public.supply_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity_needed NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending'
);

-- 4. Включаем RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read templates" ON public.document_templates;
CREATE POLICY "Public read templates" ON public.document_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth modify templates" ON public.document_templates;
CREATE POLICY "Auth modify templates" ON public.document_templates FOR ALL TO authenticated USING (true);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all invoices" ON public.invoices;
CREATE POLICY "Auth all invoices" ON public.invoices FOR ALL TO authenticated USING (true);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all invoice_items" ON public.invoice_items;
CREATE POLICY "Auth all invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (true);

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all supply_orders" ON public.supply_orders;
CREATE POLICY "Auth all supply_orders" ON public.supply_orders FOR ALL TO authenticated USING (true);

ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all supply_order_items" ON public.supply_order_items;
CREATE POLICY "Auth all supply_order_items" ON public.supply_order_items FOR ALL TO authenticated USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'products',
    description: 'Единый каталог товаров и услуг (ERP Master Data)',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text' },
      { name: 'base_price', type: 'numeric', description: 'Закупочная цена (BYN)' },
      { name: 'retail_price', type: 'numeric', description: 'Розничная цена (BYN)' }
    ]
  },
  {
    name: 'invoices',
    description: 'Выставленные счета на оплату',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'number', type: 'serial' },
        { name: 'total_amount', type: 'numeric' },
        { name: 'status', type: 'text' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по обновлению БД
Был добавлен функционал Счетов и Заказов поставщику.
Пожалуйста, перейдите в раздел **База данных** в приложении и скопируйте новый SQL-скрипт.
Выполните его в SQL Editor вашей панели Supabase.
`;
