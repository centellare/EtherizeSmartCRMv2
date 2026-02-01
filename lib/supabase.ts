
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Хелпер для замера времени выполнения запроса.
 * Использование: const { data, duration } = await measureQuery(supabase.from('tasks').select('*'));
 */
export const measureQuery = async (queryPromise: Promise<any>) => {
  const start = performance.now();
  const result = await queryPromise;
  const end = performance.now();
  const duration = Math.round(end - start);
  
  if (result.error) {
    console.error(`[DB Error] ${duration}ms:`, result.error.message);
  } else {
    console.debug(`[DB Perf] Query took ${duration}ms`);
  }
  
  return { ...result, duration };
};
