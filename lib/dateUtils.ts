
/**
 * Утилиты для работы с датами в часовом поясе Минска (Europe/Minsk)
 */

const TIMEZONE = 'Europe/Minsk';
const LOCALE = 'ru-BY';

/**
 * Форматирует дату для отображения в интерфейсе
 */
export const formatDate = (dateInput: string | Date | null | undefined, includeTime = false): string => {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined,
  }).format(date);
};

/**
 * Возвращает дату в формате YYYY-MM-DD для HTML input[type="date"]
 * на основе текущего времени в Минске
 */
export const getMinskISODate = (dateInput?: Date | string): string => {
  const date = dateInput 
    ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
    : new Date();

  // Используем sv-SE локаль, так как она дает формат YYYY-MM-DD
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Возвращает текущее время в Минске в формате ISO для сохранения в БД
 */
export const getMinskNowISO = (): string => {
  return new Date().toISOString(); // Supabase хранит в UTC, что корректно. 
  // Но для логики "сегодняшнего дня" используем getMinskISODate
};
