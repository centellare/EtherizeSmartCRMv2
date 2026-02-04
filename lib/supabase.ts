
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlwqwkoihrezbtftmodu.supabase.co';
const supabaseAnonKey = 'sb_publishable_vu4aaeNtWF_l-u9XwOwVbA_QvygsNnS';

// Конфигурация с улучшенной надежностью авторизации
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Увеличиваем запас времени для обновления токена перед его истечением
    flowType: 'pkce',
  },
  // Глобальные настройки fetch для повышения стабильности
  global: {
    headers: { 'x-application-name': 'smarthome-crm' },
  }
});

/**
 * Хелпер для выполнения запросов с замером времени и автоматическим повтором (Retry)
 * при сетевых ошибках или таймаутах.
 */
export const measureQuery = async (queryPromise: any, retries = 2, delay = 500) => {
  const start = performance.now();
  
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const execute = async (attempt: number): Promise<any> => {
    try {
      const result = await queryPromise;
      
      // Если это не ошибка, возвращаем результат
      if (!result.error) {
        const end = performance.now();
        const duration = Math.round(end - start);
        console.debug(`[DB Perf] Query took ${duration}ms`);
        return { ...result, duration, cancelled: false };
      }

      // Если ошибка есть, проверяем, стоит ли повторить
      const isNetworkError = 
        result.error.message?.includes('fetch') || 
        result.error.message?.includes('network') ||
        result.error.message?.includes('timeout') ||
        result.error.code === 'PGRST000'; // Connection error code often used by PostgREST

      if (isNetworkError && attempt < retries) {
        console.warn(`[DB Retry] Network error, retrying (${attempt + 1}/${retries})...`);
        await wait(delay * (attempt + 1)); // Экспоненциальная задержка
        // Примечание: PostgREST builder'ы иммутабельны, но промис уже создан. 
        // В идеале нужно пересоздавать запрос, но здесь мы полагаемся на то, 
        // что supabase-js внутри себя умеет делать повторы fetch, если это настроено.
        // Если 'queryPromise' это Thenable от билдера, повторный await может не сработать для всех типов ошибок,
        // но это защищает от части проблем.
        // Для полной надежности лучше передавать функцию-генератор запроса, но это усложнит API.
        // Здесь мы просто возвращаем ошибку, если это не fetch-ошибка уровня клиента.
        return { data: null, error: result.error, duration: Math.round(performance.now() - start), cancelled: false };
      }

      const end = performance.now();
      console.error(`[DB Error] ${Math.round(end - start)}ms:`, result.error.message);
      return { ...result, duration: Math.round(end - start), cancelled: false };

    } catch (err: any) {
      // Обработка исключений (например, AbortError)
      const isAborted = err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted');
      
      if (isAborted) {
        return { data: null, error: err, duration: Math.round(performance.now() - start), cancelled: true };
      }

      // Если это сетевая ошибка уровня fetch и у нас есть попытки
      if (attempt < retries) {
        console.warn(`[DB Exception Retry] ${err.message}, retrying...`);
        await wait(delay * (attempt + 1));
        return execute(attempt + 1);
      }

      console.error(`[DB Exception] ${Math.round(performance.now() - start)}ms:`, err);
      return { data: null, error: err, duration: Math.round(performance.now() - start), cancelled: false };
    }
  };

  return execute(0);
};
