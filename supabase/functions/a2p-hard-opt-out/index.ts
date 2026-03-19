/**
 * a2p-hard-opt-out
 *
 * Trigger: POST webhook when a contact replies via SMS with an opt-out phrase:
 *   "not interested", "stop", "byebye" (case-insensitive)
 *
 * Sends a final confirmation SMS, logs the opt-out in activity_log, then sets
 * dnd_sms = TRUE. All future outbound sequences are gated on dnd_sms = FALSE by
 * the message queue processor, so no explicit workflow cancellation is needed.
 *
 * Payload: { business_id, contact_id, contact_first_name, contact_last_name,
 *            contact_email, contact_phone }
 *
 * Settings columns used: twilio_phone_number
 */

import {
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  sendSMSNow,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_id: string;
      contact_first_name: string;
      contact_last_name: string;
      contact_email: string;
      contact_phone: string;
    };

    const {
      business_id,
      contact_id,
      contact_first_name,
      contact_last_name,
      contact_email,
      contact_phone,
    } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    // 1. Send final confirmation SMS immediately
    await sendSMSNow(
      contact_phone,
      "We won't text you anymore from now on. Sorry to bother and have a great day.",
      settings.twilio_phone_number,
    );

    const now = new Date();
    const dateString = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // 2. Insert activity_log record
    const { error: logErr } = await supabase.from("activity_log").insert({
      contact_id,
      activity_type: "sms_hard_opt_out",
      description:
        `SMS Hard Opt Out - Date: ${dateString}. Name: ${contact_first_name} ${contact_last_name}, Email: ${contact_email}, Phone: ${contact_phone}`,
      metadata: { business_id },
    });
    if (logErr) throw new Error(`activity_log insert failed: ${logErr.message}`);

    // 3. Set dnd_sms = TRUE
    const { error: updateErr } = await supabase
      .from("contacts")
      .update({ dnd_sms: true })
      .eq("id", contact_id)
      .eq("business_id", business_id);
    if (updateErr) throw new Error(`dnd_sms update failed: ${updateErr.message}`);

    return jsonResponse({ success: true, contact_id });
  } catch (err) {
    console.error("[a2p-hard-opt-out]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
