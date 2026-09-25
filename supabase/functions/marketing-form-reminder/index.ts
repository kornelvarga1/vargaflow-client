/**
 * marketing-form-reminder
 *
 * Trigger: Called by the message_queue cron processor after 10 days,
 *          when it encounters a function_call row scheduled by form-submission-confirmation.
 *
 * Payload: { contact_id, business_id }
 *
 * Sends an internal reminder SMS to the owner to complete their marketing form
 * for a contact who requested a quote ~10 days ago.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   (FROM number comes from settings.twilio_phone_number)
 *
 * Settings columns used:
 *   my_name, my_phone, twilio_phone_number, marketing_form_link
 */

import {
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  sendSMSNow,
  requireServiceCall,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only the message_queue cron processor may call this; it would otherwise let
  // anyone with a contact_id send SMS from the contractor's number.
  const denied = requireServiceCall(req);
  if (denied) return denied;

  try {
    const body = await req.json() as {
      contact_id: string;
      business_id: string;
    };

    const { contact_id, business_id } = body;

    const supabase = getSupabaseAdmin();

    // Fetch contact
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("full_name, phone")
      .eq("id", contact_id)
      .single();
    if (contactErr) throw new Error(`Contact not found: ${contactErr.message}`);

    const settings = await fetchSettings(supabase, business_id);

    const smsBody =
      `Hey ${settings.my_name}, heads up — it's been about 10 days since ${contact.full_name} (${contact.phone}) requested a quote on your site. If you've finished their job, add them to your marketing form so the review + referral sequences run: ${settings.marketing_form_link}`;

    await sendSMSNow(settings.my_phone, smsBody, settings.twilio_phone_number);

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[marketing-form-reminder]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
