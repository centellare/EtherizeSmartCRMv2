-- db_client_legal_data.sql

BEGIN;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS rep_position_nom TEXT,
ADD COLUMN IF NOT EXISTS rep_position_gen TEXT,
ADD COLUMN IF NOT EXISTS rep_name_nom TEXT,
ADD COLUMN IF NOT EXISTS rep_name_gen TEXT,
ADD COLUMN IF NOT EXISTS rep_name_short TEXT,
ADD COLUMN IF NOT EXISTS basis_of_authority TEXT,
ADD COLUMN IF NOT EXISTS unp TEXT,
ADD COLUMN IF NOT EXISTS bank_details TEXT;

COMMIT;
