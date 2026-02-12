
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.1 Migration Script (Logistics & Reserves)

BEGIN;

-- 1. Обновление таблицы inventory_items для резервов
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS reserved_for_invoice_id UUID REFERENCES public.invoices(id);

-- Безопасное добавление статуса 'reserved' (если это TEXT колонка, ничего не делать, если ENUM - ALTER TYPE)
DO $$ BEGIN
    -- Простая проверка, мы используем текстовые поля в схеме Supabase по умолчанию, 
    -- но если пользователь создал ENUM, код ниже может потребоваться
    -- ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'reserved'; 
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Обновление таблицы invoices для статуса отгрузки
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'none'; -- none, partial, shipped

-- 3. Индексы для ускорения поиска резервов
CREATE INDEX IF NOT EXISTS idx_inventory_reserved_invoice ON public.inventory_items(reserved_for_invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON public.inventory_items(product_id, status);

-- [Предыдущая часть скрипта для V2.0 ниже, для тех, кто не накатил]
-- ... (Existing SQL logic kept for safety) ...

-- Удаляем старые версии функции, чтобы пересоздать одну правильную
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, uuid, date, date, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, uuid, date, timestamp, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe; 

CREATE OR REPLACE FUNCTION public.create_task_safe(
    p_object_id UUID,
    p_title TEXT,
    p_assigned_to UUID,
    p_start_date DATE,
    p_deadline DATE,
    p_comment TEXT DEFAULT NULL,
    p_doc_link TEXT DEFAULT NULL,
    p_doc_name TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_stage_id TEXT;
    v_new_task_id UUID;
BEGIN
    SELECT current_stage INTO v_stage_id FROM objects WHERE id = p_object_id;

    INSERT INTO tasks (
        object_id, stage_id, title, assigned_to, start_date, deadline, 
        comment, doc_link, doc_name, created_by, status
    ) VALUES (
        p_object_id, v_stage_id, p_title, p_assigned_to, p_start_date, p_deadline, 
        p_comment, p_doc_link, p_doc_name, p_user_id, 'pending'
    ) RETURNING id INTO v_new_task_id;

    RETURN v_new_task_id;
END;
$$ LANGUAGE plpgsql;

-- Создание таблиц документов (если не были созданы в 2.0)
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, header_text TEXT, footer_text TEXT,
    signatory_1 TEXT DEFAULT 'Генеральный директор', signatory_2 TEXT DEFAULT 'Главный бухгалтер',
    is_default BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.document_templates (type, header_text, footer_text)
SELECT 'cp', 'Мы рады предложить вам следующее решение...', 'Предложение действительно 5 дней.'
WHERE NOT EXISTS (SELECT 1 FROM public.document_templates WHERE type = 'cp');

INSERT INTO public.document_templates (type, header_text, footer_text)
SELECT 'invoice', 'Внимание! Оплата данного счета означает согласие с условиями поставки товара.', 'Товар отпускается по факту прихода денег.'
WHERE NOT EXISTS (SELECT 1 FROM public.document_templates WHERE type = 'invoice');

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number SERIAL, cp_id UUID REFERENCES public.commercial_proposals(id),
    client_id UUID REFERENCES public.clients(id),
    total_amount NUMERIC DEFAULT 0, has_vat BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'draft',
    shipping_status TEXT DEFAULT 'none', -- Added here for fresh installs too
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    name TEXT NOT NULL, quantity NUMERIC DEFAULT 1, unit TEXT DEFAULT 'шт',
    price NUMERIC DEFAULT 0, total NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.supply_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id),
    status TEXT DEFAULT 'pending', created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supply_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supply_order_id UUID REFERENCES public.supply_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity_needed NUMERIC DEFAULT 0, status TEXT DEFAULT 'pending'
);

-- RLS Policies
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

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'inventory_items',
    description: 'Складской учет (единицы хранения)',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true },
      { name: 'product_id', type: 'uuid', references: 'products' },
      { name: 'status', type: 'text', description: 'in_stock | reserved | deployed | ...' },
      { name: 'reserved_for_invoice_id', type: 'uuid', description: 'Ссылка на счет резерва' }
    ]
  },
  {
    name: 'invoices',
    description: 'Счета и статус отгрузки',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'status', type: 'text' },
        { name: 'shipping_status', type: 'text', description: 'none | partial | shipped' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по обновлению (Версия 2.1)
1. Скопируйте обновленный SQL-скрипт.
2. Выполните его в SQL Editor панели Supabase.
3. Это добавит функционал **Резервирования** и **Статусов отгрузки**.
`;
