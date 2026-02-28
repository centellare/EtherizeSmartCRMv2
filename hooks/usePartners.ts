import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PartnerDTO } from '../types/dto';

export const usePartners = () => {
  return useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*, clients(count)')
        .order('name');
      
      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        contact_person: p.contact_person,
        phone: p.phone,
        email: p.email,
        default_commission_percent: p.default_commission_percent,
        status: p.status,
        notes: p.notes,
        created_at: p.created_at,
        updated_at: p.updated_at,
        total_clients: p.clients?.[0]?.count || 0
      })) as PartnerDTO[];
    }
  });
};
