
/**
 * Утилиты для работы с датами в часовом поясе Минска (Europe/Minsk)
 */

const TIMEZONE = 'Europe/Minsk';
const LOCALE = 'ru-BY';

/**
 * Форматирует дату для отображения в интерфейсе
 * Безопасная версия: никогда не выбрасывает ошибку
 */
export const formatDate = (dateInput: string | Date | null | undefined, includeTime = false): string => {
  if (!dateInput) return '—';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Проверка на Invalid Date
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: includeTime ? '2-digit' : undefined,
      minute: includeTime ? '2-digit' : undefined,
    }).format(date);
  } catch (e) {
    console.warn('Date formatting error:', e);
    return 'Ошибка даты';
  }
};

/**
 * Возвращает дату в формате YYYY-MM-DD для HTML input[type="date"]
 * на основе текущего времени в Минске
 */
export const getMinskISODate = (dateInput?: Date | string): string => {
  try {
    const date = dateInput 
      ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
      : new Date();

    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];

    // Используем sv-SE локаль, так как она дает формат YYYY-MM-DD
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch (e) {
    return new Date().toISOString().split('T')[0]; // Fallback to UTC
  }
};

/**
 * Возвращает текущее время в Минске в формате ISO для сохранения в БД
 */
export const getMinskNowISO = (): string => {
  return new Date().toISOString(); 
};

/**
 * Форматирует дату в длинный формат: «DD» month YYYY г.
 * Пример: «01» октября 2023 г.
 */
export const formatDateLong = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '—';

    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    
    // Массив месяцев в родительном падеже
    const monthsGenitive = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    
    const month = monthsGenitive[date.getMonth()];
    
    return `«${day}» ${month} ${year} г.`;
  } catch (e) {
    return 'Ошибка даты';
  }
};
