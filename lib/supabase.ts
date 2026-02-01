
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Хелпер для замера времени выполнения запроса.
 * Мы используем тип any для query, так как Supabase возвращает сложные билдеры,
 * которые являются thenable (как промисы), но имеют специфическую структуру.
 */
export const measureQuery = async (query: any) => {
  const start = performance.now();
  const result = await query;
  const end = performance.now();
  const duration = Math.round(end - start);
  
  if (result.error) {
    console.error(`[DB Error] ${duration}ms:`, result.error.message);
  } else {
    console.debug(`[DB Perf] Query took ${duration}ms`);
  }
  
  return { ...result, duration };
};
