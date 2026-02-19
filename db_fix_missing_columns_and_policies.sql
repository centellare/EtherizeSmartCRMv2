-- 1. Fix Supply Orders Table (Add missing columns)
DO $$
BEGIN
    -- Add 'number' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supply_orders' AND column_name = 'number') THEN
        ALTER TABLE public.supply_orders ADD COLUMN number SERIAL;
    END IF;

    -- Add 'comment' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supply_orders' AND column_name = 'comment') THEN
        ALTER TABLE public.supply_orders ADD COLUMN comment text;
    END IF;
END $$;

-- 2. Fix RLS Policies (Ensure creation is allowed)

-- TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tasks insert" ON public.tasks;
CREATE POLICY "Tasks insert" ON public.tasks FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager'))
);

-- COMMERCIAL PROPOSALS
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CP insert" ON public.commercial_proposals;
CREATE POLICY "CP insert" ON public.commercial_proposals FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
);

-- CP ITEMS
ALTER TABLE public.cp_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CP Items insert" ON public.cp_items;
CREATE POLICY "CP Items insert" ON public.cp_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commercial_proposals cp 
    WHERE cp.id = cp_items.cp_id AND (
      cp.created_by = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
    )
  )
);

-- INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoices insert" ON public.invoices;
CREATE POLICY "Invoices insert" ON public.invoices FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
);

-- INVOICE ITEMS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoice Items insert" ON public.invoice_items;
CREATE POLICY "Invoice Items insert" ON public.invoice_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices inv 
    WHERE inv.id = invoice_items.invoice_id AND (
      inv.created_by = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
    )
  )
);

-- SUPPLY ORDERS
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Supply insert" ON public.supply_orders;
CREATE POLICY "Supply insert" ON public.supply_orders FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
);

-- SUPPLY ORDER ITEMS
ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Supply Items insert" ON public.supply_order_items;
CREATE POLICY "Supply Items insert" ON public.supply_order_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supply_orders so 
    WHERE so.id = supply_order_items.supply_order_id AND (
      so.created_by = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager', 'storekeeper'))
    )
  )
);

-- TASK QUESTIONS
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Questions insert" ON public.task_questions;
CREATE POLICY "Questions insert" ON public.task_questions FOR INSERT WITH CHECK (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'manager'))
);
