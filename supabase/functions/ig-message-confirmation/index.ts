/**
 * ig-message-confirmation
 *
 * Trigger: POST webhook from Instagram DM
 * Payload: { contact_name, contact_phone, message, business_id, sender_id }
 *
 * sender_id: Instagram-Scoped User ID — required to reply via Instagram Messaging API.
 * Provided by the Instagram webhook event as entry[0].messaging[0].sender.id.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   (FROM number comes from settings.twilio_phone_number)
 *
 * Settings columns used:
 *   my_name, my_phone, company_name, twilio_phone_number, instagram_page_access_token
 */

import {
  addTag,
  corsHeaders,
  fetchSettings,
  getFirstName,
  getSupabaseAdmin,
  jsonResponse,
  scheduleOwnerSMS,
  sendIGMessage,
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
      sender_id: string;  // Instagram-scoped user ID — needed to reply via DM
    };

    const { contact_name, contact_phone, message, business_id, sender_id } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: contact_name,
      phone: contact_phone,
      business_id,
      lead_source: "Instagram",
    });

    await addTag(supabase, contact.id, "ig-lead");

    const firstName = getFirstName(contact_name);

    // Internal SMS to owner — 30 seconds
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id: contact.id,
      delaySeconds: 30,
      content:
        `Hey ${settings.my_name}, you just got an Instagram message from ${contact_name}. Name: ${contact_name}. Message: ${message}. We have let them know you will be in touch soon. [do not reply - not a client]`,
    });

    // Automated Instagram DM reply to lead — sent immediately
    if (sender_id && settings.instagram_page_access_token) {
      const replyText =
        `Hey ${firstName}, thanks for contacting us here at ${settings.company_name}. I am a little slow to respond via social media but I will get back to you as soon as I can. If you ever want to text me directly at ${settings.my_phone} that would be awesome. PS this is an automated text but I will read it and get back to you as soon as I have a free second. Talk soon, ${settings.my_name}`;

      await sendIGMessage(sender_id, replyText, settings.instagram_page_access_token);
    }

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[ig-message-confirmation]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
