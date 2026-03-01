
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

export const replaceDocumentTags = (text: string | null | undefined, clientData: any, documentData?: any): string => {
  if (!text) return '';
  if (!clientData && !documentData) return text;

  let result = text;
  const tags: Record<string, string> = {
    '{{client_name}}': clientData?.name || '',
    '{{legal_name}}': clientData?.legal_name || clientData?.name || '',
    '{{rep_position_nom}}': clientData?.rep_position_nom || '',
    '{{rep_position_gen}}': clientData?.rep_position_gen || '',
    '{{rep_name_nom}}': clientData?.rep_name_nom || '',
    '{{rep_name_gen}}': clientData?.rep_name_gen || '',
    '{{rep_name_short}}': clientData?.rep_name_short || '',
    '{{basis_of_authority}}': clientData?.basis_of_authority || '',
    '{{unp}}': clientData?.unp || '',
    '{{bank_details}}': clientData?.bank_details || '',
    '{{contact_person}}': clientData?.contact_person || '',
    '{{phone}}': clientData?.phone || '',
    '{{email}}': clientData?.email || '',
    // Document specific tags
    '{{contract_number}}': documentData?.contract_number || '',
    '{{contract_date}}': documentData?.contract_date || '',
    '{{contract_amount}}': documentData?.contract_amount || '',
    '{{amount_words}}': documentData?.amount_words || '',
    '{{vat_amount}}': documentData?.vat_amount || '',
    '{{vat_amount_words}}': documentData?.vat_amount_words || '',
    '{{purchase_subject}}': documentData?.purchase_subject || '',
    '{{delivery_days}}': documentData?.delivery_days || '',
    '{{purchase_purpose}}': documentData?.purchase_purpose || '',
    '{{funding_source}}': documentData?.funding_source || '',
    '{{payment_deadline_days}}': documentData?.payment_deadline_days ? documentData.payment_deadline_days.toString() : '',
  };

  // Partial payment calculations
  if (documentData && typeof documentData.total_amount_value === 'number') {
      const totalAmount = documentData.total_amount_value;
      const totalVat = documentData.total_vat_value || 0;
      
      let percent = 100;
      if (documentData.prepayment_percent !== undefined && documentData.prepayment_percent !== null && documentData.prepayment_percent !== '') {
          percent = Number(documentData.prepayment_percent);
          if (isNaN(percent)) percent = 100;
      }
      
      const prepAmount = totalAmount * (percent / 100);
      const prepVat = totalVat * (percent / 100);
      const remAmount = totalAmount - prepAmount;
      const remVat = totalVat - prepVat;
      
      const fmt = (n: number) => new Intl.NumberFormat('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' руб.';

      tags['{{prepayment_percent}}'] = percent.toString();
      tags['{{prepayment_amount}}'] = fmt(prepAmount);
      tags['{{prepayment_amount_words}}'] = sumInWords(prepAmount);
      tags['{{prepayment_vat_amount}}'] = fmt(prepVat);
      tags['{{prepayment_vat_amount_words}}'] = sumInWords(prepVat);

      tags['{{remaining_percent}}'] = (100 - percent).toString();
      tags['{{remaining_amount}}'] = fmt(remAmount);
      tags['{{remaining_amount_words}}'] = sumInWords(remAmount);
      tags['{{remaining_vat_amount}}'] = fmt(remVat);
      tags['{{remaining_vat_amount_words}}'] = sumInWords(remVat);
  } else {
      // Fallback if values not provided
      tags['{{prepayment_percent}}'] = documentData?.prepayment_percent || '';
  }

  for (const [tag, value] of Object.entries(tags)) {
    // Use global replace
    // Handle newlines for HTML content
    const safeValue = String(value).replace(/\n/g, '<br/>');
    result = result.split(tag).join(safeValue);
  }

  return result;
};
