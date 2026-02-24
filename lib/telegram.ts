
// Telegram Bot Token (should be in env vars, but for client-side demo we put it here or ask user)
// Ideally, use a proxy or Edge Function.
// For this demo, we use direct fetch with no-cors (opaque) or a public proxy if needed.
// Actually, Telegram API supports GET requests which can be fired from browser (opaque response).

export const DEFAULT_BOT_TOKEN = '8137528952:AAE5kWOn9l0JuSQyHG0TJPUGRBrnAMhHFXc';

// We will use a localStorage key to override the bot token if needed
export const getBotToken = () => {
  return localStorage.getItem('TELEGRAM_BOT_TOKEN') || DEFAULT_BOT_TOKEN;
};

export const setBotToken = (token: string) => {
  localStorage.setItem('TELEGRAM_BOT_TOKEN', token);
};

/**
 * Sends a message to a Telegram chat.
 * Note: This runs in the browser. Telegram API does not support CORS for POST requests.
 * We use GET request which works but returns an opaque response (we can't read the result).
 */
export const sendTelegramMessage = async (chatId: string, text: string) => {
  const token = getBotToken();
  if (!token) {
    console.warn('Telegram Bot Token not set');
    return false;
  }

  if (!chatId) {
    console.warn('Telegram Chat ID not set');
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}&parse_mode=HTML`;

  try {
    // mode: 'no-cors' allows the request to be sent, but we can't read the response.
    // This is enough for "fire and forget" notifications.
    await fetch(url, { mode: 'no-cors' });
    console.log('Telegram message sent (opaque response)');
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
};
