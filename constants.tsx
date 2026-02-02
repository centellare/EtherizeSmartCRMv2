
import { TableSchema } from './types';

export const INITIAL_SUGGESTED_SCHEMA: TableSchema[] = [
  {
    name: 'profiles',
    description: 'Профили сотрудников. Роли: admin, director, manager, specialist.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, description: 'ID пользователя' },
      { name: 'full_name', type: 'text', description: 'ФИО' },
      { name: 'email', type: 'text', description: 'Email' },
      { name: 'role', type: 'user_role', description: 'Роль в системе' },
      { name: 'phone', type: 'text', isNullable: true, description: 'Телефон' },
      { name: 'must_change_password', type: 'boolean', defaultValue: 'false', description: 'Флаг сброса пароля' }
    ]
  },
  {
    name: 'clients',
    description: 'База клиентов (Физлица и Юрлица).',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, description: 'PK' },
      { name: 'type', type: 'client_type', description: 'Тип (person/company)' },
      { name: 'name', type: 'text', description: 'Имя / Наименование' },
      { name: 'phone', type: 'text', isNullable: true, description: 'Телефон' },
      { name: 'email', type: 'text', isNullable: true, description: 'Email' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()', description: 'Дата добавления' }
    ]
  },
  {
    name: 'objects',
    description: 'Объекты (проекты) системы.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'name', type: 'text', description: 'Название' },
      { name: 'address', type: 'text', isNullable: true },
      { name: 'current_stage', type: 'text', defaultValue: "'negotiation'" },
      { name: 'current_status', type: 'text', defaultValue: "'in_work'" },
      { name: 'client_id', type: 'uuid', isForeign: true, references: 'clients(id)' },
      { name: 'responsible_id', type: 'uuid', isForeign: true, references: 'profiles(id)' }
    ]
  },
  {
    name: 'tasks',
    description: 'Задачи по объектам.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'object_id', type: 'uuid', isForeign: true, references: 'objects(id)' },
      { name: 'title', type: 'text' },
      { name: 'assigned_to', type: 'uuid', isForeign: true, references: 'profiles(id)' },
      { name: 'status', type: 'text', defaultValue: "'pending'" },
      { name: 'deadline', type: 'timestamp', isNullable: true }
    ]
  },
  {
    name: 'task_checklists',
    description: 'Подзадачи (чек-листы) внутри основных задач.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'task_id', type: 'uuid', isForeign: true, references: 'tasks(id)' },
      { name: 'content', type: 'text', description: 'Текст подзадачи' },
      { name: 'is_completed', type: 'boolean', defaultValue: 'false' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по внедрению SQL:
1. Зайдите в SQL Editor в Supabase.
2. Скопируйте и выполните SQL для создания таблицы подзадач:

\`\`\`sql
-- Таблица подзадач (чек-листы)
CREATE TABLE IF NOT EXISTS public.task_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Настройка RLS
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

-- Директора и админы могут всё
CREATE POLICY "Checklist full access for admins" ON public.task_checklists
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'director'))
    );

-- Исполнители могут обновлять статус
CREATE POLICY "Checklist update for executors" ON public.task_checklists
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.tasks WHERE id = task_checklists.task_id AND assigned_to = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.tasks WHERE id = task_checklists.task_id AND assigned_to = auth.uid())
    );

-- Все остальные могут только смотреть
CREATE POLICY "Checklist read access" ON public.task_checklists
    FOR SELECT USING (true);
\`\`\`

3. Добавьте функцию для завершения проектов:

\`\`\`sql
CREATE OR REPLACE FUNCTION public.finalize_project(
    p_object_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.object_stages
    SET status = 'completed', completed_at = NOW()
    WHERE object_id = p_object_id AND status = 'active';

    UPDATE public.objects
    SET current_status = 'completed', updated_at = NOW(), updated_by = p_user_id, rolled_back_from = NULL
    WHERE id = p_object_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
\`\`\`

4. Нажмите Run.
`;
