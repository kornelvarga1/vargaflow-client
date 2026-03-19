/**
 * form-submission-confirmation
 *
 * Trigger: POST webhook from website quote/contact form submission
 * Payload: { contact_name, contact_phone, contact_email, message, business_id }
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
  scheduleFunctionCall,
  scheduleOwnerSMS,
  upsertContact,
} from "../_shared/helpers.ts";

const TEN_DAYS_SECONDS = 10 * 24 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      contact_name: string;
      contact_phone: string;
      contact_email?: string;
      message: string;
      business_id: string;
    };

    const { contact_name, contact_phone, contact_email, message, business_id } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: contact_name,
      phone: contact_phone,
      email: contact_email,
      business_id,
      lead_source: "Form Submission",
    });

    await addTag(supabase, contact.id, "form-submission");

    const firstName = getFirstName(contact_name);

    // Internal SMS to owner — 30 seconds
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id: contact.id,
      delaySeconds: 30,
      content:
        `New lead from website form. Name: ${contact_name}. Phone: ${contact_phone}. Message: ${message}. We have let them know you will be in touch soon. [do not reply - not a client]`,
    });

    // Message 1 to contact — 30 seconds
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      delaySeconds: 30,
      content:
        `Hey ${firstName}, got your quote form. I will be in touch shortly — ${settings.my_name}, ${settings.company_name}`,
    });

    // Message 2 to contact — 60 seconds
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      delaySeconds: 60,
      content:
        `I will be in touch shortly. Sorry I haven't had enough coffee today. Talk soon.`,
    });

    // Schedule 10-day marketing form reminder (processed by message_queue cron → marketing-form-reminder function)
    await scheduleFunctionCall(supabase, {
      function_name: "marketing-form-reminder",
      contact_id: contact.id,
      delaySeconds: TEN_DAYS_SECONDS,
      payload: { contact_id: contact.id, business_id },
    });

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[form-submission-confirmation]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
