
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Данные считаются свежими 1 минуту (не будет повторных запросов при переключении вкладок)
      staleTime: 1000 * 60, 
      // Кэш хранится 5 минут
      gcTime: 1000 * 60 * 5,
      // При возврате на вкладку браузера обновляем данные
      refetchOnWindowFocus: true,
      // При переподключении сети обновляем данные
      refetchOnReconnect: true,
      // Количество повторных попыток при ошибке
      retry: 1,
    },
  },
});
