/**
 * missed-call-text-back
 *
 * Trigger: POST webhook from Twilio (voice status callback)
 * Fires only for inbound calls with status: busy | canceled | voicemail | no-answer
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   (FROM number comes from settings.twilio_phone_number)
 */

import {
  addTag,
  corsHeaders,
  fetchSettings,
  getFirstName,
  getSupabaseAdmin,
  jsonResponse,
  scheduleContactSMS,
  upsertContact,
} from "../_shared/helpers.ts";

const MISSED_STATUSES = new Set(["busy", "canceled", "voicemail", "no-answer"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      To: string;
      From: string;
      CallStatus: string;
      CallDirection: string;
      business_id: string;
    };

    const { To, From, CallStatus, CallDirection, business_id } = body;

    if (CallDirection !== "inbound" || !MISSED_STATUSES.has(CallStatus?.toLowerCase())) {
      return jsonResponse({ skipped: true, reason: "Not a missed inbound call" });
    }

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: From,     // placeholder — CRM can update name later
      phone: From,
      business_id,
      lead_source: "Missed Call",
    });

    await addTag(supabase, contact.id, "missed-call");

    const firstName = getFirstName(contact.full_name);

    // Message 1 — 1 minute delay
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      delaySeconds: 60,
      content:
        `Hey, sorry I missed you. I will get back to you as soon as possible. If you want to give me a few details about the job, that would be great. You can click this link for a free quote: ${settings.quote_form_link} — ${settings.my_name} from ${settings.company_name}`,
    });

    // Message 2 — 3 minutes delay
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      delaySeconds: 180,
      content:
        `Look forward to hearing from you. In the meantime, are there any questions I can answer here for you?`,
    });

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[missed-call-text-back]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
