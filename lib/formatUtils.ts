
/**
 * Утилиты для форматирования сумм и текстов
 */

export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(val);
};

// Исправленная реализация суммы прописью с корректным склонением родов (две тысячи / два рубля)
export const sumInWords = (amount: number): string => {
  if (amount === 0) return 'Ноль белорусских рублей 00 копеек';

  const rub = Math.floor(amount);
  const kop = Math.round((amount - rub) * 100);

  const words: Record<number, string> = {
    0: '', 1: 'один', 2: 'два', 3: 'три', 4: 'четыре', 5: 'пять', 6: 'шесть', 7: 'семь', 8: 'восемь', 9: 'девять',
    10: 'десять', 11: 'одиннадцать', 12: 'двенадцать', 13: 'тринадцать', 14: 'четырнадцать', 15: 'пятнадцать',
    16: 'шестнадцать', 17: 'семнадцать', 18: 'восемнадцать', 19: 'девятнадцать',
    20: 'двадцать', 30: 'тридцать', 40: 'сорок', 50: 'пятьдесят', 60: 'шестьдесят', 70: 'семьдесят', 80: 'восемьдесят', 90: 'девяносто',
    100: 'сто', 200: 'двести', 300: 'триста', 400: 'четыреста', 500: 'пятьсот', 600: 'шестьсот', 700: 'семьсот', 800: 'восемьсот', 900: 'девятьсот'
  };

  const getGroup = (n: number, gender: 'male' | 'female'): string => {
    const h = Math.floor(n / 100) * 100;
    const t = n % 100;
    const u = n % 10;
    
    let res = '';
    if (h > 0) res += words[h] + ' ';
    
    if (t > 0 && t < 20) {
      // Исправление: проверяем род даже для чисел < 20 (для 1 и 2)
      if (t === 1 && gender === 'female') res += 'одна ';
      else if (t === 2 && gender === 'female') res += 'две ';
      else res += words[t] + ' ';
    } else {
      if (t >= 20) res += words[Math.floor(t / 10) * 10] + ' ';
      if (u > 0) {
        if (gender === 'female' && u === 1) res += 'одна ';
        else if (gender === 'female' && u === 2) res += 'две ';
        else res += words[u] + ' ';
      }
    }
    return res.trim();
  };

  const getCase = (n: number, one: string, two: string, five: string) => {
    const t = n % 100;
    const u = n % 10;
    if (t >= 11 && t <= 19) return five;
    if (u === 1) return one;
    if (u >= 2 && u <= 4) return two;
    return five;
  };

  let result = '';
  
  // Millions
  if (rub >= 1000000) {
      const mil = Math.floor(rub / 1000000);
      result += getGroup(mil, 'male') + ' ' + getCase(mil, 'миллион', 'миллиона', 'миллионов') + ' ';
  }
  
  // Thousands
  const th = Math.floor((rub % 1000000) / 1000);
  if (th > 0) {
      result += getGroup(th, 'female') + ' ' + getCase(th, 'тысяча', 'тысячи', 'тысяч') + ' ';
  }

  // Hundreds
  const hu = rub % 1000;
  if (hu > 0 || (rub < 1000 && result === '')) {
      result += getGroup(hu, 'male') + ' ';
  }

  // Currency
  result = result.trim() + ' ' + getCase(rub, 'белорусский рубль', 'белорусских рубля', 'белорусских рублей');
  result += ` ${kop.toString().padStart(2, '0')} копеек`;

  return result.charAt(0).toUpperCase() + result.slice(1);
};
