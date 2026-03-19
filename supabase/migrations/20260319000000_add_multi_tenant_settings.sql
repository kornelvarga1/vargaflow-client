-- Multi-tenant settings table
-- Stores per-business client variables fetched by business_id in edge functions
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL UNIQUE,
  my_name TEXT NOT NULL DEFAULT '',
  my_phone TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  twilio_phone_number TEXT NOT NULL DEFAULT '',
  quote_form_link TEXT NOT NULL DEFAULT '',
  marketing_form_link TEXT NOT NULL DEFAULT '',
  facebook_page_access_token TEXT DEFAULT '',
  instagram_page_access_token TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add business_id to contacts for multi-tenant scoping
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS business_id UUID;

-- Unique constraint so upsert on (phone, business_id) works
CREATE UNIQUE INDEX IF NOT EXISTS contacts_phone_business_id_unique
  ON public.contacts (phone, business_id)
  WHERE phone IS NOT NULL AND business_id IS NOT NULL;

-- Extend message_queue for owner notifications and function scheduling
ALTER TABLE public.message_queue ADD COLUMN IF NOT EXISTS to_phone TEXT;
ALTER TABLE public.message_queue ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Allow NULL contact_id for owner-only internal messages
ALTER TABLE public.message_queue ALTER COLUMN contact_id DROP NOT NULL;
