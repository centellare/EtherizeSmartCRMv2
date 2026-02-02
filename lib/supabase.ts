
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Хелпер для замера времени выполнения запроса с защитой от AbortError.
 */
export const measureQuery = async (query: any) => {
  const start = performance.now();
  
  try {
    const result = await query;
    const end = performance.now();
    const duration = Math.round(end - start);
    
    if (result.error) {
      const isAborted = result.error.name === 'AbortError' || 
                       result.error.message?.toLowerCase().includes('aborted');
      
      if (isAborted) {
        return { data: null, error: result.error, duration, cancelled: true };
      }
      console.error(`[DB Error] ${duration}ms:`, result.error.message);
    } else {
      console.debug(`[DB Perf] Query took ${duration}ms`);
    }
    
    return { ...result, duration, cancelled: false };
  } catch (err: any) {
    const end = performance.now();
    const duration = Math.round(end - start);
    const isAborted = err.name === 'AbortError' || 
                     err.message?.toLowerCase().includes('aborted');

    if (isAborted) {
      return { data: null, error: err, duration, cancelled: true };
    }
    
    console.error(`[DB Exception] ${duration}ms:`, err);
    return { data: null, error: err, duration, cancelled: false };
  }
};
