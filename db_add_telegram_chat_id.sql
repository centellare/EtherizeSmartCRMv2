-- Add telegram_chat_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Add comment
COMMENT ON COLUMN profiles.telegram_chat_id IS 'Telegram Chat ID for notifications';
