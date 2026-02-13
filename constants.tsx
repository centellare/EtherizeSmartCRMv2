
import { TableSchema } from './types';

// Migration SQL to be executed by user
export const MIGRATION_SQL_V2 = `
-- SmartHome ERP 2.5: Fix Permissions & Roles (Патч прав доступа)

BEGIN;

-- 1. СБРОС И ОБНОВЛЕНИЕ ПРАВ ДОСТУПА (RLS) ДЛЯ ЗАДАЧ
-- Удаляем старые, возможно конфликтующие политики
DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.tasks;

-- Создаем единую политику обновления:
-- Разрешено: Админам, Директорам, Создателю задачи, Исполнителю задачи
CREATE POLICY "Tasks update policy" ON public.tasks
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR
  auth.uid() = assigned_to
  OR
  auth.uid() = created_by
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR
  auth.uid() = assigned_to
  OR
  auth.uid() = created_by
);

-- 2. Гарантируем наличие полей (безопасно)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES public.objects(id);

COMMIT;

NOTIFY pgrst, 'reload schema';
`;

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'tasks',
    description: 'Задачи (обновление прав)',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'completed_by', type: 'uuid', description: 'Кто завершил', references: 'profiles' }
    ]
  },
  {
    name: 'products',
    description: 'Номенклатура',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'image_url', type: 'text', description: 'Ссылка на фото товара' }
    ]
  },
  {
    name: 'commercial_proposals',
    description: 'Коммерческие предложения',
    columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'object_id', type: 'uuid', description: 'Привязка к объекту', references: 'objects' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### ВАЖНО: Исправление прав доступа (Версия 2.5)
1. Скопируйте SQL-скрипт ниже.
2. Откройте SQL Editor в Supabase.
3. Выполните скрипт.
   
Это исправит ошибку "Нет прав", разрешив Директорам и Исполнителям закрывать задачи.
`;
