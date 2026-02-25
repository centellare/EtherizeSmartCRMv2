-- db_fix_recursion.sql

BEGIN;

-- 1. Fix Objects view policy
-- The problem: Objects view checks Tasks, and Tasks view checks Objects.
-- Solution: Break the cycle. Objects can check tasks directly without triggering the Tasks view policy
-- by using a direct table reference or simplifying the check.

DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid()) OR
  id IN (SELECT object_id FROM tasks WHERE assigned_to = auth.uid())
);

-- 2. Fix Tasks view policy
-- We use a similar approach to avoid circular references.
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  object_id IN (
    SELECT id FROM objects 
    WHERE client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid())
  )
);

COMMIT;
