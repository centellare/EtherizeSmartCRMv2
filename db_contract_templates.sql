-- ==========================================
-- FILE: db_contract_templates.sql
-- ==========================================

-- 1. Create table for contract templates
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL UNIQUE, -- 'individual_100', 'individual_partial', 'legal_100', 'legal_partial'
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
-- Allow all authenticated users to view templates
CREATE POLICY "Users can view contract templates"
  ON public.contract_templates FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- Allow all authenticated users to insert templates
CREATE POLICY "Users can insert contract templates"
  ON public.contract_templates FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

-- Allow all authenticated users to update templates
CREATE POLICY "Users can update contract templates"
  ON public.contract_templates FOR UPDATE
  USING ( auth.role() = 'authenticated' );

-- Allow all authenticated users to delete templates
CREATE POLICY "Users can delete contract templates"
  ON public.contract_templates FOR DELETE
  USING ( auth.role() = 'authenticated' );

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_contract_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER trg_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION update_contract_templates_updated_at();

-- 5. Insert default empty templates if they don't exist
INSERT INTO public.contract_templates (type, content)
VALUES 
  ('individual_100', 'Договор с физ. лицом (100% предоплата)'),
  ('individual_partial', 'Договор с физ. лицом (Частичная оплата)'),
  ('legal_100', 'Договор с юр. лицом (100% предоплата)'),
  ('legal_partial', 'Договор с юр. лицом (Частичная оплата)')
ON CONFLICT (type) DO NOTHING;
