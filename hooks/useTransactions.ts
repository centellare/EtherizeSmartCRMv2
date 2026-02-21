
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Transaction } from '../types';

export const useTransactions = (options: { 
  objectId?: string; 
  startDate?: string; 
  endDate?: string;
  isSpecialist?: boolean;
  userId?: string;
} = {}) => {
  return useQuery({
    queryKey: ['transactions', options],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(`
          *, 
          objects(id, name, responsible_id), 
          creator:profiles!transactions_created_by_fkey(full_name),
          processor:profiles!processed_by(full_name),
          payments:transaction_payments(
            *,
            creator:profiles!transaction_payments_created_by_fkey(full_name)
          )
        `)
        .is('deleted_at', null);

      if (options.objectId) {
        query = query.eq('object_id', options.objectId);
      }

      if (options.isSpecialist && options.userId) {
        query = query.eq('created_by', options.userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        payments: (t.payments || []).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
        created_by_name: t.creator?.full_name || 'Система',
        processor_name: t.processor?.full_name || null
      })) as Transaction[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // 30 seconds
  });
};
