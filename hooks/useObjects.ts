
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Object as CRMObject } from '../types';
import { ObjectStageDTO } from '../types/dto';

export const useObjects = () => {
  return useQuery({
    queryKey: ['objects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*, client:clients(id, name)')
        .is('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CRMObject[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useObject = (id: string | null) => {
  return useQuery({
    queryKey: ['object', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('objects')
        .select('*, client:clients(name), responsible:profiles!responsible_id(id, full_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as CRMObject;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useObjectStages = (objectId: string | null) => {
  return useQuery({
    queryKey: ['object_stages', objectId],
    queryFn: async () => {
      if (!objectId) return [];
      const { data, error } = await supabase
        .from('object_stages')
        .select('*')
        .eq('object_id', objectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ObjectStageDTO[];
    },
    enabled: !!objectId,
    staleTime: 1000 * 60 * 5,
  });
};
