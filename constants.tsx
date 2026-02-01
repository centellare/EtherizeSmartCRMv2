
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
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по внедрению SQL:
1. Зайдите в SQL Editor в Supabase.
2. Скопируйте SQL скрипт из вкладки "База данных".
3. Добавьте новую функцию для стабильного завершения проектов:

\`\`\`sql
CREATE OR REPLACE FUNCTION public.finalize_project(
    p_object_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
BEGIN
    -- 1. Закрываем текущий активный этап
    UPDATE public.object_stages
    SET status = 'completed',
        completed_at = NOW()
    WHERE object_id = p_object_id AND status = 'active';

    -- 2. Завершаем сам объект
    UPDATE public.objects
    SET current_status = 'completed',
        updated_at = NOW(),
        updated_by = p_user_id,
        rolled_back_from = NULL
    WHERE id = p_object_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
\`\`\`

4. Нажмите Run.
`;
