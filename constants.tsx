
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
    name: 'transaction_payments',
    description: 'Фактические платежи по транзакциям.',
    columns: [
      { name: 'id', type: 'uuid', isPrimary: true, defaultValue: 'gen_random_uuid()' },
      { name: 'transaction_id', type: 'uuid', isForeign: true, references: 'transactions(id)' },
      { name: 'amount', type: 'numeric' },
      { name: 'requires_doc', type: 'boolean', defaultValue: 'false' },
      { name: 'doc_type', type: 'text', isNullable: true },
      { name: 'doc_number', type: 'text', isNullable: true },
      { name: 'doc_date', type: 'date', isNullable: true }
    ]
  }
];

export const SUPABASE_SETUP_GUIDE = `
### SQL для внедрения закрывающих документов:
Выполните этот код в SQL Editor Supabase для расширения таблицы платежей:

\`\`\`sql
-- Добавление полей для закрывающих документов
ALTER TABLE public.transaction_payments 
ADD COLUMN IF NOT EXISTS requires_doc BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS doc_type TEXT,
ADD COLUMN IF NOT EXISTS doc_number TEXT,
ADD COLUMN IF NOT EXISTS doc_date DATE;

-- Создание индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_payments_doc_number ON public.transaction_payments(doc_number);

-- Обновление типов данных (если нужно)
COMMENT ON COLUMN public.transaction_payments.requires_doc IS 'Нужен ли акт/накладная для этого платежа';
\`\`\`
`;
