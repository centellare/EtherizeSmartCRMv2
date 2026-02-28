import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ProposalDTO } from '../types/dto';

export const useProposals = () => {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commercial_proposals')
        .select('*, client:clients(name), creator:profiles(full_name), invoices(id, number, status)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any[]; // Cast to any because of complex joins not fully matching DTO strictly without mapping
    }
  });
};

export const useProposal = (id: string | null) => {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('commercial_proposals')
        .select('*, client:clients(*), creator:profiles(*), items:cp_items(*, parent_id, product:products(name, unit))')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      const proposal = data as unknown as ProposalDTO;

      // Sort items by created_at if available, or just return as is
      if (proposal.items) {
          proposal.items.sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      }
      
      return proposal;
    },
    enabled: !!id
  });
};
