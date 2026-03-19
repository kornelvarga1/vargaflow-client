-- Add GMB review link and website URL to settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS gmb_review_link TEXT NOT NULL DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS website_url TEXT NOT NULL DEFAULT '';

-- Add business_id to custom_values for multi-tenant support
-- (e.g. discount_amount per business)
ALTER TABLE public.custom_values ADD COLUMN IF NOT EXISTS business_id UUID;

-- Replace the single-column unique constraint with multi-tenant compound indexes.
-- Existing rows with NULL business_id are preserved via the partial index below.
ALTER TABLE public.custom_values DROP CONSTRAINT IF EXISTS custom_values_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS custom_values_key_business_id_idx
  ON public.custom_values (key, business_id)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS custom_values_key_single_tenant_idx
  ON public.custom_values (key)
  WHERE business_id IS NULL;
