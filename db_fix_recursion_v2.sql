-- db_fix_recursion_v2.sql

BEGIN;

-- 1. Create SECURITY DEFINER functions to bypass RLS during policy checks
-- This prevents the infinite recursion between objects and tasks policies.

CREATE OR REPLACE FUNCTION public.has_object_task(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.tasks WHERE object_id = obj_id AND assigned_to = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_client_object(obj_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.objects o
    JOIN public.profiles p ON p.client_id = o.client_id
    WHERE o.id = obj_id AND p.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Objects view
DROP POLICY IF EXISTS "Objects view" ON public.objects;
CREATE POLICY "Objects view" ON public.objects FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') OR 
  responsible_id = auth.uid() OR 
  client_id = (SELECT p.client_id FROM profiles p WHERE p.id = auth.uid()) OR
  public.has_object_task(id, auth.uid())
);

-- 3. Update Tasks view
DROP POLICY IF EXISTS "Tasks view" ON public.tasks;
CREATE POLICY "Tasks view" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin', 'director', 'manager') OR 
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR
  public.is_client_object(object_id, auth.uid())
);

COMMIT;
