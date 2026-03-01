-- ==========================================
-- FILE: db_contracts.sql
-- ==========================================

-- 1. Create table for generated contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_number text NOT NULL,
  content text NOT NULL,
  amount numeric(15,2),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
-- Allow all authenticated users to view contracts
CREATE POLICY "Users can view contracts"
  ON public.contracts FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- Allow all authenticated users to insert contracts
CREATE POLICY "Users can insert contracts"
  ON public.contracts FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

-- Allow all authenticated users to update contracts
CREATE POLICY "Users can update contracts"
  ON public.contracts FOR UPDATE
  USING ( auth.role() = 'authenticated' );

-- Allow all authenticated users to delete contracts
CREATE POLICY "Users can delete contracts"
  ON public.contracts FOR DELETE
  USING ( auth.role() = 'authenticated' );

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION update_contracts_updated_at();
