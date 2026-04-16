-- ============================================================
-- client_sequence_templates
-- Global default templates + per-business overrides for all
-- client-facing automation flows.
--
-- business_id IS NULL  → global default template
-- business_id IS SET   → override for that specific business
--
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_sequence_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_name       TEXT        NOT NULL,
  step_name       TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'sms',  -- 'sms' | 'email' | 'fb_message' | 'ig_message'
  subject         TEXT,                                -- email subject template only
  content         TEXT        NOT NULL,
  delay_seconds   INT         NOT NULL DEFAULT 0,      -- informational only (displayed in UI)
  business_id     UUID,                                -- NULL = global default
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: one global default per (flow, step)
CREATE UNIQUE INDEX IF NOT EXISTS cst_global_unique
  ON client_sequence_templates (flow_name, step_name)
  WHERE business_id IS NULL;

-- Unique: one override per (flow, step, business)
CREATE UNIQUE INDEX IF NOT EXISTS cst_business_unique
  ON client_sequence_templates (flow_name, step_name, business_id)
  WHERE business_id IS NOT NULL;

-- RLS
ALTER TABLE client_sequence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage client templates"
  ON client_sequence_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Service role (edge functions) can read
CREATE POLICY "Service role can read client templates"
  ON client_sequence_templates FOR SELECT TO service_role
  USING (true);

-- ============================================================
-- Seed: global default templates (business_id IS NULL)
-- Variables: {{first_name}} {{my_name}} {{company_name}}
--            {{my_phone}} {{quote_form_link}} {{website_url}}
--            {{contact_phone}} {{review_link}}
--            {{discount_amount}} {{reactivation_offer}}
-- ============================================================

INSERT INTO client_sequence_templates (flow_name, step_name, message_type, content, delay_seconds, business_id) VALUES

-- ── missed-call-text-back ───────────────────────────────────
('missed-call-text-back', 'sms1', 'sms',
  'Hey, sorry I missed you. I will get back to you as soon as possible. If you want to give me a few details about the job, that would be great. You can click this link for a free quote: {{quote_form_link}} — {{my_name}} from {{company_name}}',
  60, NULL),

('missed-call-text-back', 'sms2', 'sms',
  'Look forward to hearing from you. In the meantime, are there any questions I can answer here for you?',
  180, NULL),

-- ── form-submission-confirmation ───────────────────────────
('form-submission-confirmation', 'sms1', 'sms',
  'Hey {{first_name}}, got your quote form. I will be in touch shortly — {{my_name}}, {{company_name}}',
  30, NULL),

('form-submission-confirmation', 'sms2', 'sms',
  'I will be in touch shortly. Sorry I haven''t had enough coffee today. Talk soon.',
  60, NULL),

-- ── db-reactivation ────────────────────────────────────────
('db-reactivation', 'sms_initial', 'sms',
  'Hey {{first_name}}, wanted to reach out because my team and I are doing a {{reactivation_offer}} this week. Only catch is we can only bring on three clients while supplies last. You might be interested — let me know, no worries either way. {{my_name}}',
  0, NULL),

('db-reactivation', 'sms_followup', 'sms',
  'Hey {{first_name}}, did you get my text yesterday? Only have two spots left for the offer. Let me know if I should save you a spot while we have the extra supplies — respond back with yes or no so I know whether to save your spot or not. Enjoy your day. {{my_name}}',
  0, NULL),

-- ── db-reactivation (email) ────────────────────────────────
('db-reactivation', 'email_initial', 'email',
  'Hey {{first_name}}, I tried to text you at {{contact_phone}}. Wanted to reach out because my team and I are doing a {{reactivation_offer}} this week. Only catch is we can only bring on three clients while supplies last. Thought you might be interested. Let me know — no worries either way. {{my_name}} from {{company_name}}',
  0, NULL),

-- ── review-request-sequence ────────────────────────────────
('review-request-sequence', 'sms1', 'sms',
  'Hey {{first_name}}, this is {{my_name}}. I hope you had a great experience with {{company_name}}. We donate a meal to charity for every customer who takes 10 seconds to leave a review. Here is the link: {{review_link}}',
  0, NULL),

('review-request-sequence', 'sms2', 'sms',
  'Hey {{first_name}}, I wanted to follow up because I saw you haven''t left a review yet. We donate a meal to charity for every customer that leaves a review. If you have 10 seconds to help someone you know or don''t know, you are our kind of people. Click here: {{review_link}} PS - just say ''bye'' if you want me to stop texting you',
  0, NULL),

('review-request-sequence', 'sms3', 'sms',
  'Little review reminder in case you got extra busy this week. (We give a free meal to someone in need for each new review.) Here is the link again: {{review_link}}',
  0, NULL),

('review-request-sequence', 'sms4', 'sms',
  'Hey {{first_name}}, this is the last time I will request a review from you, I promise. If you have a sec to leave one, we will donate a meal to a person in need. Here''s the link — and thanks for helping those in need: {{review_link}}',
  0, NULL),

-- ── one-year-referral-sequence ─────────────────────────────
('one-year-referral-sequence', 'sms1', 'sms',
  'Hey {{first_name}}, I am running a season special this week and giving {{discount_amount}}. It''s only for the first 3 people — so if you are interested or know someone who might be, just tap the link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}',
  0, NULL),

('one-year-referral-sequence', 'sms2', 'sms',
  'Hey {{first_name}}, I am running a customer anniversary special for the next 6 days and giving {{discount_amount}}. So if you are interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}',
  0, NULL),

('one-year-referral-sequence', 'sms3', 'sms',
  'Hey {{first_name}}, I am running a loyalty special this week and giving {{discount_amount}}. It''s only for the first 3 people — so if you are interested or know someone who might be, just tap the link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}',
  0, NULL),

('one-year-referral-sequence', 'sms4', 'sms',
  'Hey {{first_name}}, I am running a special this week and giving {{discount_amount}} on referrals. It''s only for the first 4 people — so if you are interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}',
  0, NULL),

('one-year-referral-sequence', 'sms5', 'sms',
  'Hey {{first_name}}, I am running an anniversary special giving {{discount_amount}}. It''s only for the first 6 days — so if you''re interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}',
  0, NULL),

-- ── discount-form-submission ───────────────────────────────
('discount-form-submission', 'sms1', 'sms',
  'Hey {{first_name}}, just got your discounted job request. I will be in touch shortly and get you that discount. {{my_name}} from {{company_name}}',
  120, NULL),

-- ── chat-widget-lead ───────────────────────────────────────
('chat-widget-lead', 'sms1', 'sms',
  'Hey {{first_name}}, just got your text through my web chat. Thanks for reaching out 😊 I will be in touch as soon as I am free. — {{my_name}}, {{company_name}}',
  10, NULL),

('chat-widget-lead', 'sms2', 'sms',
  '*thanks for reaching out. Sorry I haven''t had enough coffee today haha. By the way, if you have any other questions in the meantime, feel free to message me here.',
  40, NULL),

-- ── fb-message-confirmation ────────────────────────────────
('fb-message-confirmation', 'fb_reply', 'fb_message',
  'Hey {{first_name}}, thanks for reaching us here at {{company_name}}. I am a little slow to respond via social media but I will get back to you as soon as I can. If you ever want to text me directly at {{my_phone}} that would be awesome. PS this is an automated text but I will read it and get back to you as soon as I have a free second. Talk soon, {{my_name}}',
  0, NULL),

-- ── ig-message-confirmation ────────────────────────────────
('ig-message-confirmation', 'ig_reply', 'ig_message',
  'Hey {{first_name}}, thanks for contacting us here at {{company_name}}. I am a little slow to respond via social media but I will get back to you as soon as I can. If you ever want to text me directly at {{my_phone}} that would be awesome. PS this is an automated text but I will read it and get back to you as soon as I have a free second. Talk soon, {{my_name}}',
  0, NULL)

ON CONFLICT DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_sequence_templates_updated_at
  BEFORE UPDATE ON client_sequence_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
