import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { TransactionDTO } from '../types/dto';
import { notifyRole } from '../lib/notifications';

interface CreateTransactionPayload {
  object_id: string;
  type: 'income' | 'expense';
  amount: number;
  planned_amount?: number | null;
  requested_amount?: number | null;
  planned_date: string;
  category: string;
  section: string;
  description?: string | null;
  doc_link?: string | null;
  doc_name?: string | null;
  created_by: string;
}

interface UpdateTransactionPayload {
  id: string;
  object_id: string;
  amount: number;
  planned_amount?: number | null;
  requested_amount?: number | null;
  planned_date: string;
  category: string;
  section: string;
  description?: string | null;
  doc_link?: string | null;
  doc_name?: string | null;
  updated_by: string;
}

interface CreatePaymentPayload {
  transaction_id: string;
  amount: number;
  payment_date: string;
  comment?: string | null;
  requires_doc?: boolean;
  doc_type?: string | null;
  doc_number?: string | null;
  doc_date?: string | null;
  created_by: string;
}

interface UpdatePaymentPayload {
  id: string;
  amount: number;
  payment_date: string;
  comment?: string | null;
  requires_doc?: boolean;
  doc_type?: string | null;
  doc_number?: string | null;
  doc_date?: string | null;
  updated_by: string;
}

export const useFinanceMutations = (profileId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createTransaction = useMutation({
    mutationFn: async (payload: CreateTransactionPayload) => {
      const newTransaction = await api.create<TransactionDTO>('transactions', {
        ...payload,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (payload.type === 'expense') {
        await notifyRole(['admin', 'director'], `Новый запрос на расход: ${payload.amount} BYN (${payload.category})`, `#finances/${newTransaction.id}`);
      }

      return newTransaction;
    },
    onSuccess: () => {
      toast.success('Запись успешно создана');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании записи: ${error.message}`);
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async (payload: UpdateTransactionPayload) => {
      return api.update<TransactionDTO>('transactions', payload.id, {
        ...payload,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Запись обновлена');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении записи: ${error.message}`);
    },
  });

  const createPayment = useMutation({
    mutationFn: async ({ payload, transaction }: { payload: CreatePaymentPayload, transaction: TransactionDTO }) => {
      await api.create('transaction_payments', {
        ...payload,
        created_at: new Date().toISOString(),
      });

      const newFact = (transaction.fact_amount || 0) + payload.amount;
      const status = newFact >= transaction.amount - 0.01 ? 'approved' : 'partial';
      
      await api.update('transactions', transaction.id, { 
        status, 
        fact_amount: newFact,
        updated_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Платеж успешно добавлен');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при добавлении платежа: ${error.message}`);
    },
  });

  const updatePayment = useMutation({
    mutationFn: async (payload: UpdatePaymentPayload) => {
      await api.update('transaction_payments', payload.id, {
        ...payload,
      });
    },
    onSuccess: () => {
      toast.success('Платеж обновлен');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении платежа: ${error.message}`);
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      await api.softDelete('transactions', id, profileId);
    },
    onSuccess: () => {
      toast.success('Запись удалена');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    }
  });

  const deletePayment = useMutation({
    mutationFn: async ({ id, transactions }: { id: string, transactions: TransactionDTO[] }) => {
      const { data: payment, error: fetchError } = await supabase.from('transaction_payments').select('amount, transaction_id').eq('id', id).single();
      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase.from('transaction_payments').delete().eq('id', id);
      if (deleteError) throw deleteError;

      if (payment) {
        const trans = transactions.find(t => t.id === payment.transaction_id);
        if (trans) {
          const newFact = Math.max(0, (trans.fact_amount || 0) - payment.amount);
          const newStatus = newFact >= trans.amount - 0.01 ? 'approved' : (newFact > 0 ? 'partial' : 'pending');
          
          await api.update('transactions', payment.transaction_id, { 
            fact_amount: newFact, 
            status: newStatus 
          });
        }
      }
    },
    onSuccess: () => {
      toast.success('Платеж удален');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении платежа: ${error.message}`);
    }
  });

  const approveTransaction = useMutation({
    mutationFn: async ({ id, amount }: { id: string, amount: number }) => {
      await api.update('transactions', id, {
        status: 'approved', 
        amount, 
        processed_by: profileId, 
        processed_at: new Date().toISOString() 
      });
    },
    onSuccess: () => {
      toast.success('Запись утверждена');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при утверждении: ${error.message}`);
    }
  });

  const simpleAction = useMutation({
    mutationFn: async ({ action, data }: { action: 'reject' | 'finalize', data: TransactionDTO }) => {
      if (action === 'reject') {
        await api.update('transactions', data.id, {
          status: 'rejected', 
          processed_by: profileId, 
          processed_at: new Date().toISOString() 
        });
      } else {
        await api.update('transactions', data.id, {
          status: 'approved', 
          amount: data.fact_amount || 0 
        });
      }
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'reject' ? 'Запись отклонена' : 'Запись утверждена');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка: ${error.message}`);
    }
  });

  return {
    createTransaction,
    updateTransaction,
    createPayment,
    updatePayment,
    deleteTransaction,
    deletePayment,
    approveTransaction,
    simpleAction
  };
};
