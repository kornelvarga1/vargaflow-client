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
  fetchClientTemplate,
  fetchSettings,
  getFirstName,
  getSupabaseAdmin,
  jsonResponse,
  resolveClientTemplate,
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
    if (!business_id || !contact_name || !contact_phone) {
      return jsonResponse({ error: "Missing required fields: business_id, contact_name, contact_phone" }, 400);
    }

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

    const vars = {
      first_name: firstName,
      my_name: settings.my_name ?? "",
      company_name: settings.company_name ?? "",
    };

    // Message 1 to contact — 30 seconds
    const tpl1 = await fetchClientTemplate(supabase, "form-submission-confirmation", "sms1", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 30,
      content: resolveClientTemplate(
        tpl1?.content ?? `Hey {{first_name}}, got your quote form. I will be in touch shortly — {{my_name}}, {{company_name}}`,
        vars,
      ),
    });

    // Message 2 to contact — 90 seconds (past next cron tick to guarantee order)
    const tpl2 = await fetchClientTemplate(supabase, "form-submission-confirmation", "sms2", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 90,
      content: resolveClientTemplate(
        tpl2?.content ?? `I will be in touch shortly. Sorry I haven't had enough coffee today. Talk soon.`,
        vars,
      ),
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
