
-- SmartHome CRM: PATCH v6.4 (Payments Fix)
-- Этот патч добавляет пропущенные права доступа для таблицы платежей.
-- Выполните этот скрипт, если получаете ошибку при добавлении оплаты/поступления.

BEGIN;

-- 1. Включаем защиту (если еще не включена)
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем старые политики этой таблицы (на всякий случай, чтобы избежать конфликтов имен)
DROP POLICY IF EXISTS "Payments manage" ON public.transaction_payments;
DROP POLICY IF EXISTS "Payments view" ON public.transaction_payments;

-- 3. Добавляем права на УПРАВЛЕНИЕ (создание, редактирование, удаление)
-- Разрешено: Админ, Директор, Менеджер, Снабжение/Финансы
CREATE POLICY "Payments manage" ON public.transaction_payments
FOR ALL
USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper')
);

-- 4. Добавляем права на ПРОСМОТР
-- Разрешено: Руководству (все) и Специалистам (только платежи по их транзакциям, если таковые будут)
CREATE POLICY "Payments view" ON public.transaction_payments
FOR SELECT
USING (
  get_my_role() IN ('admin', 'director', 'manager', 'storekeeper') 
  OR 
  EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.id = transaction_id AND t.created_by = auth.uid()
  )
);

COMMIT;
