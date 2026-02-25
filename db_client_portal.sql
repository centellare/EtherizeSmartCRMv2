-- db_client_portal.sql

-- 1. Add 'client' to user_role ENUM (cannot run inside a transaction block)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Add client_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- 3. Update RLS for objects so clients can see their own objects
DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM tasks WHERE object_id = objects.id AND assigned_to = auth.uid()) OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 4. Update RLS for tasks so clients can see tasks for their objects
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM objects o 
    WHERE o.id = tasks.object_id 
    AND o.client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);

-- 5. Update RLS for invoices so clients can see their invoices
DROP POLICY IF EXISTS "Invoices view" ON public.invoices;
CREATE POLICY "Invoices view" ON public.invoices FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 6. Update RLS for invoice_items
DROP POLICY IF EXISTS "Inv Items view" ON public.invoice_items;
CREATE POLICY "Inv Items view" ON public.invoice_items FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_items.invoice_id 
    AND i.client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);

-- 7. Update RLS for commercial_proposals
DROP POLICY IF EXISTS "CP view" ON public.commercial_proposals;
CREATE POLICY "CP view" ON public.commercial_proposals FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR created_by = auth.uid() OR
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
);

-- 8. Update RLS for cp_items
DROP POLICY IF EXISTS "CP Items view" ON public.cp_items;
CREATE POLICY "CP Items view" ON public.cp_items FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR
  EXISTS (
    SELECT 1 FROM commercial_proposals cp 
    WHERE cp.id = cp_items.cp_id 
    AND cp.client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);
