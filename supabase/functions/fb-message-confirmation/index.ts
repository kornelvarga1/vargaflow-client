/**
 * fb-message-confirmation
 *
 * Trigger: POST webhook from Facebook Messenger
 * Payload: { contact_name, contact_phone, message, business_id, sender_id }
 *
 * sender_id: Facebook Page-Scoped User ID (PSID) — required to reply via Messenger API.
 * This is provided by the Facebook webhook event as entry[0].messaging[0].sender.id.
 * Wire your FB webhook adapter to forward it here.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   (FROM number comes from settings.twilio_phone_number)
 *
 * Settings columns used:
 *   my_name, my_phone, company_name, twilio_phone_number, facebook_page_access_token
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
  scheduleOwnerSMS,
  sendFBMessage,
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
      sender_id: string;  // Facebook PSID — needed to reply via Messenger
    };

    const { contact_name, contact_phone, message, business_id, sender_id } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: contact_name,
      phone: contact_phone,
      business_id,
      lead_source: "Facebook",
    });

    await addTag(supabase, contact.id, "facebook-lead");

    const firstName = getFirstName(contact_name);

    // Internal SMS to owner — 30 seconds
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id: contact.id,
      delaySeconds: 30,
      content:
        `Hey ${settings.my_name}, you just got a Facebook message from ${contact_name}. Name: ${contact_name}. Message: ${message}. We have let them know you will be in touch soon. [do not reply - not a client]`,
    });

    // Automated FB Messenger reply to lead — sent immediately
    if (sender_id && settings.facebook_page_access_token) {
      const vars = {
        first_name: firstName,
        my_name: settings.my_name ?? "",
        company_name: settings.company_name ?? "",
        my_phone: settings.my_phone ?? "",
      };
      const tpl = await fetchClientTemplate(supabase, "fb-message-confirmation", "fb_reply", business_id);
      const replyText = resolveClientTemplate(
        tpl?.content ?? `Hey {{first_name}}, thanks for reaching us here at {{company_name}}. I am a little slow to respond via social media but I will get back to you as soon as I can. If you ever want to text me directly at {{my_phone}} that would be awesome. PS this is an automated text but I will read it and get back to you as soon as I have a free second. Talk soon, {{my_name}}`,
        vars,
      );
      await sendFBMessage(sender_id, replyText, settings.facebook_page_access_token);
    }

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[fb-message-confirmation]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
