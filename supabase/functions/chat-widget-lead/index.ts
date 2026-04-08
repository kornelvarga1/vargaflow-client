/**
 * chat-widget-lead
 *
 * Trigger: POST webhook when a website chat widget message is received
 * Payload: { contact_name, contact_phone, message, business_id }
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
  scheduleOwnerSMS,
  upsertContact,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      contact_name: string;
      contact_phone: string;
      message: string;
      business_id: string;
    };

    const { contact_name, contact_phone, message, business_id } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: contact_name,
      phone: contact_phone,
      business_id,
      lead_source: "Chat Widget",
    });

    await addTag(supabase, contact.id, "chat-widget-lead");

    const firstName = getFirstName(contact_name);

    // Internal SMS to owner — immediate (0 second delay)
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id: contact.id,
      delaySeconds: 0,
      content:
        `New lead from website chat widget. Name: ${contact_name}. Phone: ${contact_phone}. Message: ${message}. We have let them know you will be in touch soon. [do not reply - not a client]`,
    });

    const vars = {
      first_name: firstName,
      my_name: settings.my_name ?? "",
      company_name: settings.company_name ?? "",
    };

    // Message 1 to contact — 10 seconds
    const tpl1 = await fetchClientTemplate(supabase, "chat-widget-lead", "sms1", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 10,
      content: resolveClientTemplate(
        tpl1?.content ?? `Hey {{first_name}}, just got your text through my web chat. Thanks for reaching out 😊 I will be in touch as soon as I am free. — {{my_name}}, {{company_name}}`,
        vars,
      ),
    });

    // Message 2 to contact — 40 seconds
    const tpl2 = await fetchClientTemplate(supabase, "chat-widget-lead", "sms2", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 40,
      content: resolveClientTemplate(
        tpl2?.content ?? `*thanks for reaching out. Sorry I haven't had enough coffee today haha. By the way, if you have any other questions in the meantime, feel free to message me here.`,
        vars,
      ),
    });

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[chat-widget-lead]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
