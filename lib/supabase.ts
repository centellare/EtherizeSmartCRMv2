
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Хелпер для замера времени выполнения запроса с защитой от Promise Hang.
 */
export const measureQuery = async (query: any, timeoutMs = 12000) => {
  const start = performance.now();
  
  // Мгновенная проверка сети, чтобы не ждать таймаута при явном отсутствии связи
  if (!navigator.onLine) {
    return { data: null, error: { message: 'Network offline' }, duration: 0, cancelled: false };
  }

  let timeoutId: any;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('Query Timeout');
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([query, timeoutPromise]) as any;
    clearTimeout(timeoutId);
    
    const end = performance.now();
    const duration = Math.round(end - start);
    
    if (result.error) {
      const isAborted = result.error.name === 'AbortError' || 
                       result.error.message?.toLowerCase().includes('aborted');
      
      if (isAborted) {
        return { data: null, error: result.error, duration, cancelled: true };
      }
    }
    
    return { ...result, duration, cancelled: false };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const end = performance.now();
    const duration = Math.round(end - start);
    
    const isAborted = err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted');
    const isTimeout = err.name === 'TimeoutError' || err.message === 'Query Timeout';

    if (isAborted) {
      return { data: null, error: err, duration, cancelled: true };
    }
    
    if (isTimeout) {
      console.warn(`[Network] Запрос прерван по таймауту (${duration}ms) для разблокировки UI`);
    }
    
    return { data: null, error: err, duration, cancelled: false };
  }
};
