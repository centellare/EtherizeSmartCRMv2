
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Хелпер для замера времени выполнения запроса с защитой от "зависания".
 */
export const measureQuery = async (query: any) => {
  const start = performance.now();
  
  try {
    // Supabase запросы являются Thenable.
    const result = await query;
    const end = performance.now();
    const duration = Math.round(end - start);
    
    if (result.error) {
      // Игнорируем ошибки отмены запроса (AbortError)
      if (result.error.message?.toLowerCase().includes('aborted')) {
        console.debug(`[DB Cancelled] ${duration}ms`);
        return { data: null, error: null, duration, cancelled: true };
      }
      console.error(`[DB Error] ${duration}ms:`, result.error.message);
    } else {
      console.debug(`[DB Perf] Query took ${duration}ms`);
    }
    
    return { ...result, duration };
  } catch (err: any) {
    const end = performance.now();
    const duration = Math.round(end - start);

    if (err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted')) {
      console.debug(`[DB Aborted Catch] ${duration}ms`);
      return { data: null, error: null, duration, cancelled: true };
    }
    
    console.error(`[DB Exception] ${duration}ms:`, err);
    return { data: null, error: err, duration };
  }
};
