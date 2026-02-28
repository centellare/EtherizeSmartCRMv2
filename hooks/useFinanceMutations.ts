import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';

export const useFinanceMutations = (profileId: string) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
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
    mutationFn: async ({ id, transactions }: { id: string, transactions: any[] }) => {
      const { data: payment, error: fetchError } = await supabase.from('transaction_payments').select('amount, transaction_id').eq('id', id).single();
      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase.from('transaction_payments').delete().eq('id', id);
      if (deleteError) throw deleteError;

      if (payment) {
        const trans = transactions.find(t => t.id === payment.transaction_id);
        if (trans) {
          const newFact = Math.max(0, (trans.fact_amount || 0) - payment.amount);
          const newStatus = newFact >= trans.amount - 0.01 ? 'approved' : (newFact > 0 ? 'partial' : 'pending');
          const { error: updateError } = await supabase.from('transactions').update({ fact_amount: newFact, status: newStatus }).eq('id', payment.transaction_id);
          if (updateError) throw updateError;
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
      const { error } = await supabase.from('transactions').update({ 
        status: 'approved', 
        amount, 
        processed_by: profileId, 
        processed_at: new Date().toISOString() 
      }).eq('id', id);
      if (error) throw error;
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
    mutationFn: async ({ action, data }: { action: 'reject' | 'finalize', data: any }) => {
      if (action === 'reject') {
        const { error } = await supabase.from('transactions').update({ 
          status: 'rejected', 
          processed_by: profileId, 
          processed_at: new Date().toISOString() 
        }).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').update({ 
          status: 'approved', 
          amount: data.fact_amount || 0 
        }).eq('id', data.id);
        if (error) throw error;
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
    deleteTransaction,
    deletePayment,
    approveTransaction,
    simpleAction
  };
};
