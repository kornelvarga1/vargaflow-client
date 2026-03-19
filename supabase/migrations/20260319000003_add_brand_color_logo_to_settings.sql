-- Add branding columns to settings for chat widget personalisation
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#16a34a';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
