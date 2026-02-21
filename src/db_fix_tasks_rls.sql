-- Fix RLS policies for Task Checklists and Questions
-- This script enables RLS and adds policies that delegate access control to the parent Task.

BEGIN;

-- 1. Enable RLS
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_questions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Checklists view" ON public.task_checklists;
DROP POLICY IF EXISTS "Checklists manage" ON public.task_checklists;
DROP POLICY IF EXISTS "Questions view" ON public.task_questions;
DROP POLICY IF EXISTS "Questions manage" ON public.task_questions;
DROP POLICY IF EXISTS "Users can view task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can insert task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can update task questions" ON public.task_questions;
DROP POLICY IF EXISTS "Users can delete task questions" ON public.task_questions;

-- 3. Create Policies for Task Checklists
-- Allow view if user has access to the parent task
CREATE POLICY "Checklists view" ON public.task_checklists FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

-- Allow manage (insert/update/delete) if user has access to the parent task
CREATE POLICY "Checklists manage" ON public.task_checklists FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_checklists.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

-- 4. Create Policies for Task Questions
-- Allow view if user has access to the parent task
CREATE POLICY "Questions view" ON public.task_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

-- Allow manage if user has access to the parent task
CREATE POLICY "Questions manage" ON public.task_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_questions.task_id 
    AND (
      get_my_role() IN ('admin', 'director', 'manager') OR 
      tasks.assigned_to = auth.uid() OR 
      tasks.created_by = auth.uid()
    )
  )
);

COMMIT;
