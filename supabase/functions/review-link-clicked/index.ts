/**
 * review-link-clicked
 *
 * Trigger: POST webhook when the 5-star review funnel link is clicked
 * Payload: { business_id, contact_id, contact_first_name }
 *
 * Inserts an activity_log row (activity_type = 'review_link_clicked') so that
 * review-request-sequence can detect the click in its check steps.
 *
 * Settings columns used: my_name, my_phone, twilio_phone_number
 */

import {
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  scheduleContactSMS,
  scheduleOwnerSMS,
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
    };

    const { business_id, contact_id, contact_first_name } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    // Record the click so review-request-sequence check steps can detect it
    const { error: logErr } = await supabase.from("activity_log").insert({
      contact_id,
      activity_type: "review_link_clicked",
      description: `${contact_first_name} clicked the 5-star review link`,
      metadata: { business_id },
    });
    if (logErr) throw new Error(`activity_log insert failed: ${logErr.message}`);

    // Immediate internal SMS to owner
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id,
      delaySeconds: 0,
      content:
        `Hey ${settings.my_name}, ${contact_first_name} clicked on your 5-star review link. Hopefully they left a good review — but don't worry if they didn't, it won't get posted to your page. (Do not reply to this message - not the client)`,
    });

    // Thank-you SMS to contact — 5 minutes
    await scheduleContactSMS(supabase, {
      contact_id,
      delaySeconds: 300,
      content: `Thank you for reviewing us. It means the world to our small business.`,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[review-link-clicked]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
