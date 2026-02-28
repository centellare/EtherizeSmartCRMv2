import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const useInventoryStock = () => {
  return useQuery({
    queryKey: ['inventory_stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('product_id, quantity')
        .eq('status', 'in_stock')
        .is('deleted_at', null);
      
      if (error) throw error;
      
      const stocks = (data || []).reduce((acc: Record<string, number>, item: any) => {
          acc[item.product_id] = (acc[item.product_id] || 0) + item.quantity;
          return acc;
      }, {});
      
      return stocks as Record<string, number>;
    }
  });
};
