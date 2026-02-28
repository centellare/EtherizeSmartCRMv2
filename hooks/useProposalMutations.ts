import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { ProposalDTO, ProposalItemDTO } from '../types/dto';

interface CreateProposalPayload {
  number: number;
  title?: string | null;
  client_id: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  exchange_rate: number;
  discount_percent: number | null;
  has_vat: boolean;
  total_amount_byn?: number | null;
  created_by: string | null;
}

interface UpdateProposalPayload {
  id: string;
  title?: string | null;
  client_id?: string | null;
  status?: 'draft' | 'sent' | 'accepted' | 'rejected';
  discount_percent?: number | null;
  has_vat?: boolean;
  total_amount_byn?: number | null;
}

interface CreateItemPayload {
  cp_id: string;
  product_id: string | null;
  quantity: number;
  price_at_moment: number;
  final_price_byn: number;
  snapshot_name?: string | null;
  snapshot_description?: string | null;
  snapshot_unit?: string | null;
  parent_id?: string | null;
}

interface UpdateItemPayload {
  id: string;
  quantity?: number;
  price_at_moment?: number;
  final_price_byn?: number;
  snapshot_name?: string | null;
  snapshot_description?: string | null;
  parent_id?: string | null;
}

export const useProposalMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const createProposal = useMutation({
    mutationFn: async (payload: CreateProposalPayload) => {
      return api.create<ProposalDTO>('commercial_proposals', {
        ...payload,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('КП создано');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при создании КП: ${error.message}`);
    },
  });

  const updateProposal = useMutation({
    mutationFn: async (payload: UpdateProposalPayload) => {
      return api.update<ProposalDTO>('commercial_proposals', payload.id, {
        ...payload,
      });
    },
    onSuccess: (data) => {
      toast.success('КП обновлено');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', data.id] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении КП: ${error.message}`);
    },
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      // Manual cascade delete
      const { error: itemsError } = await supabase.from('cp_items').delete().eq('cp_id', id);
      if (itemsError) throw itemsError;

      const { error: cpError } = await supabase.from('commercial_proposals').delete().eq('id', id);
      if (cpError) throw cpError;
    },
    onSuccess: () => {
      toast.success('КП удалено');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении КП: ${error.message}`);
    },
  });

  const createItem = useMutation({
    mutationFn: async (payload: CreateItemPayload) => {
      return api.create<ProposalItemDTO>('cp_items', {
        ...payload,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: (data) => {
      // toast.success('Позиция добавлена'); // Optional toast
      queryClient.invalidateQueries({ queryKey: ['proposal', data.cp_id] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при добавлении позиции: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async (payload: UpdateItemPayload) => {
      return api.update<ProposalItemDTO>('cp_items', payload.id, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposal', data.cp_id] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при обновлении позиции: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      return api.delete('cp_items', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal'] }); 
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении позиции: ${error.message}`);
    },
  });

  const saveProposalWithItems = useMutation({
    mutationFn: async ({ header, items, cpId }: { header: any, items: any[], cpId?: string }) => {
      let finalId = cpId;
      
      // 1. Header
      if (finalId) {
        await api.update('commercial_proposals', finalId, header);
        // Delete old items
        await supabase.from('cp_items').delete().eq('cp_id', finalId);
      } else {
        const res = await api.create<ProposalDTO>('commercial_proposals', header);
        finalId = res.id;
      }

      if (!finalId) throw new Error('Failed to get CP ID');

      // 2. Items
      // Need to handle hierarchy (parent_id)
      // First insert roots, get IDs, then insert children with parent IDs mapped
      
      const roots = items.filter((c: any) => !c.parent_unique_id);
      const children = items.filter((c: any) => c.parent_unique_id);
      const idMap: Record<string, string> = {};

      if (roots.length > 0) {
          const rootPayloads = roots.map((item: any) => ({
              cp_id: finalId,
              product_id: item.product_id,
              quantity: item.quantity,
              final_price_byn: item.final_price_byn,
              price_at_moment: item.price_at_moment,
              manual_markup: item.manual_markup_percent,
              snapshot_name: item.name,
              snapshot_description: item.description,
              snapshot_unit: item.unit,
              snapshot_global_category: item.category,
              parent_id: null
          }));
          
          const { data: insertedRoots, error: rootError } = await supabase.from('cp_items').insert(rootPayloads).select('id');
          if (rootError) throw rootError;
          
          if (insertedRoots) {
              insertedRoots.forEach((row, idx) => {
                  idMap[roots[idx].unique_id] = row.id;
              });
          }
      }

      if (children.length > 0) {
          const childPayloads = children.map((item: any) => ({
              cp_id: finalId,
              product_id: item.product_id,
              quantity: item.quantity,
              final_price_byn: item.final_price_byn,
              price_at_moment: item.price_at_moment,
              manual_markup: item.manual_markup_percent,
              snapshot_name: item.name,
              snapshot_description: item.description,
              snapshot_unit: item.unit,
              snapshot_global_category: item.category,
              parent_id: item.parent_unique_id ? idMap[item.parent_unique_id] : null
          }));
          
          const { error: childError } = await supabase.from('cp_items').insert(childPayloads);
          if (childError) throw childError;
      }
      
      return finalId;
    },
    onSuccess: () => {
      toast.success('КП успешно сохранено');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при сохранении КП: ${error.message}`);
    }
  });

  return {
    createProposal,
    updateProposal,
    deleteProposal,
    createItem,
    updateItem,
    deleteItem,
    saveProposalWithItems
  };
};
