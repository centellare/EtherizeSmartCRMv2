-- 1. Task Questions (Вопросы к задачам)
CREATE TABLE IF NOT EXISTS public.task_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  answered_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 2. Commercial Proposals (Коммерческие предложения)
CREATE TABLE IF NOT EXISTS public.commercial_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number serial,
  title text,
  client_id uuid REFERENCES public.clients(id),
  object_id uuid REFERENCES public.objects(id),
  status text DEFAULT 'draft',
  total_amount_byn numeric DEFAULT 0,
  has_vat boolean DEFAULT true,
  exchange_rate numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 3. CP Items (Позиции КП)
CREATE TABLE IF NOT EXISTS public.cp_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cp_id uuid REFERENCES public.commercial_proposals(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  parent_id uuid, -- Ссылка на родительский элемент (для комплектов)
  quantity numeric DEFAULT 1,
  price_at_moment numeric DEFAULT 0,
  final_price_byn numeric DEFAULT 0,
  manual_markup numeric DEFAULT 0,
  snapshot_name text,
  snapshot_description text,
  snapshot_unit text,
  snapshot_global_category text,
  created_at timestamptz DEFAULT now()
);

-- 4. Invoices (Счета)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number serial,
  cp_id uuid REFERENCES public.commercial_proposals(id),
  client_id uuid REFERENCES public.clients(id),
  object_id uuid REFERENCES public.objects(id),
  status text DEFAULT 'draft',
  total_amount numeric DEFAULT 0,
  has_vat boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 5. Invoice Items (Позиции счета)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  parent_id uuid,
  name text,
  quantity numeric DEFAULT 1,
  unit text,
  price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 6. Supply Orders (Заказы поставщикам)
CREATE TABLE IF NOT EXISTS public.supply_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number serial,
  invoice_id uuid REFERENCES public.invoices(id),
  status text DEFAULT 'pending',
  comment text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- 7. Supply Order Items (Позиции заказа)
CREATE TABLE IF NOT EXISTS public.supply_order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_order_id uuid REFERENCES public.supply_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id),
  quantity_needed numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 8. Включение RLS для новых таблиц
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;

-- 9. Политики доступа (базовые)
-- Task Questions
CREATE POLICY "Questions view" ON public.task_questions FOR SELECT USING (true);
CREATE POLICY "Questions insert" ON public.task_questions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Questions update" ON public.task_questions FOR UPDATE USING (true);
CREATE POLICY "Questions delete" ON public.task_questions FOR DELETE USING (auth.uid() = created_by);

-- CP & Invoices (Admin/Manager access)
-- Note: More granular policies are in db_reset.sql, but these ensure basic access if reset wasn't run
CREATE POLICY "CP access" ON public.commercial_proposals FOR ALL USING (true);
CREATE POLICY "CP Items access" ON public.cp_items FOR ALL USING (true);
CREATE POLICY "Invoices access" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Invoice Items access" ON public.invoice_items FOR ALL USING (true);
CREATE POLICY "Supply access" ON public.supply_orders FOR ALL USING (true);
CREATE POLICY "Supply Items access" ON public.supply_order_items FOR ALL USING (true);
