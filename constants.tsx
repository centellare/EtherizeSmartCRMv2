
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
      { name: 'contact_person', type: 'text', isNullable: true, description: 'Контактное лицо (для ЮЛ)' },
      { name: 'contact_position', type: 'text', isNullable: true, description: 'Должность (для ЮЛ)' },
      { name: 'phone', type: 'text', isNullable: true, description: 'Телефон' },
      { name: 'email', type: 'text', isNullable: true, description: 'Email' },
      { name: 'requisites', type: 'text', isNullable: true, description: 'Реквизиты' },
      { name: 'comment', type: 'text', isNullable: true, description: 'Комментарий' },
      { name: 'manager_id', type: 'uuid', isForeign: true, references: 'profiles(id)', description: 'Ответственный' },
      { name: 'created_by', type: 'uuid', isForeign: true, references: 'profiles(id)', description: 'Кто создал' },
      { name: 'created_at', type: 'timestamp', defaultValue: 'now()', description: 'Дата добавления' },
      { name: 'updated_at', type: 'timestamp', defaultValue: 'now()', description: 'Дата изменения' }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### Инструкция по внедрению SQL:
1. Зайдите в SQL Editor в Supabase.
2. Скопируйте SQL скрипт из вкладки "База данных".
3. Нажмите Run.
`;
