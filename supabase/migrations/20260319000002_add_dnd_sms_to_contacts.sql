-- Add DND (do-not-disturb) SMS flag to contacts
-- TRUE = contact has opted out, FALSE = contact is opted in (default)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS dnd_sms BOOLEAN NOT NULL DEFAULT FALSE;
