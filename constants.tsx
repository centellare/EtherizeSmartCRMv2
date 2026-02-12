
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.0 Migration Script
-- FIX: Удаление дубликатов функций для исправления ошибки "Could not choose the best candidate function"

BEGIN;

-- Удаляем старые версии функции, чтобы пересоздать одну правильную
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, uuid, date, date, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe(uuid, text, uuid, date, timestamp, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_task_safe; -- Drop generic to be safe

-- Создаем единую правильную функцию (Deadline -> Date)
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
    -- 1. Определяем текущий этап объекта
    SELECT current_stage INTO v_stage_id
    FROM objects
    WHERE id = p_object_id;

    -- 2. Создаем задачу
    INSERT INTO tasks (
        object_id,
        stage_id,
        title,
        assigned_to,
        start_date,
        deadline,
        comment,
        doc_link,
        doc_name,
        created_by,
        status
    ) VALUES (
        p_object_id,
        v_stage_id,
        p_title,
        p_assigned_to,
        p_start_date,
        p_deadline,
        p_comment,
        p_doc_link,
        p_doc_name,
        p_user_id,
        'pending'
    ) RETURNING id INTO v_new_task_id;

    RETURN v_new_task_id;
END;
$$ LANGUAGE plpgsql;

-- [Остальная часть скрипта миграции для шаблонов и счетов, если она еще не была применена...]
-- Если таблицы уже существуют, IF NOT EXISTS пропустит их.

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
Был обновлен скрипт для исправления ошибки "Could not choose the best candidate function".
Пожалуйста, перейдите в раздел **База данных** в приложении и скопируйте новый SQL-скрипт.
Выполните его в SQL Editor вашей панели Supabase.
`;
