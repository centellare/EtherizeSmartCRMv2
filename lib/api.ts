import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export class ApiClient {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async get<T>(table: string, query?: (query: any) => any): Promise<T[]> {
    let q = this.client.from(table).select('*');
    if (query) q = query(q);
    
    const { data, error } = await q;
    if (error) throw error;
    return data as T[];
  }

  async getOne<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data as T;
  }

  async create<T>(table: string, payload: any): Promise<T> {
    const { data, error } = await this.client.from(table).insert(payload).select().single();
    if (error) throw error;
    return data as T;
  }

  async update<T>(table: string, id: string, payload: any): Promise<T> {
    const { data, error } = await this.client.from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq('id', id);
    if (error) throw error;
  }

  async softDelete(table: string, id: string, userId?: string): Promise<void> {
    const payload: any = { is_deleted: true, deleted_at: new Date().toISOString() };
    if (userId) payload.updated_by = userId;
    
    const { error } = await this.client.from(table).update(payload).eq('id', id);
    if (error) throw error;
  }
}

export const api = new ApiClient(supabase);
