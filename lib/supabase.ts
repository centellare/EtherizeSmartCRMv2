
import { createClient } from '@supabase/supabase-js';
import { Database } from '../database.types';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

// Monkey patch navigator.locks.request to prevent timeouts on Supabase locks
// This fixes "Acquiring an exclusive Navigator LockManager lock timed out" error in restricted environments
if (typeof window !== 'undefined' && window.navigator && window.navigator.locks) {
  const originalRequest = window.navigator.locks.request.bind(window.navigator.locks);
  (window.navigator.locks as any).request = async (name: string, ...args: any[]) => {
    // Check if it's a Supabase lock (starts with lock:sb-)
    if (name && typeof name === 'string' && name.startsWith('lock:sb-')) {
       // Execute callback immediately without acquiring a real lock
       // The last argument is always the callback
       const callback = args[args.length - 1];
       if (typeof callback === 'function') {
         // Mock lock object
         const mockLock = { name };
         try {
           return await callback(mockLock);
         } catch (e) {
           console.error('Error in mock lock callback:', e);
           throw e;
         }
       }
    }
    return (originalRequest as any)(name, ...args);
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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

/**
 * Легковесная проверка соединения с базой.
 * Использует таблицу profiles, запрашивая 0 строк (HEAD-like request).
 */
export const checkConnection = async () => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    return !error;
  } catch {
    return false;
  }
};
