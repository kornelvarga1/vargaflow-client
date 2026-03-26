/**
 * negative-feedback-received
 *
 * Trigger: POST webhook when a review survey is submitted with 1–3 star rating
 * Payload: { business_id, contact_id, contact_first_name, contact_phone, star_rating, feedback_text }
 *
 * Settings columns used: my_name, my_phone, twilio_phone_number
 */

import {
  addTag,
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  scheduleOwnerSMS,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_id: string | null;
      contact_first_name: string;
      contact_phone: string | null;
      star_rating: number;
      feedback_text: string;
    };

    const { business_id, contact_id, contact_first_name, contact_phone, star_rating, feedback_text } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    if (contact_id) {
      await addTag(supabase, contact_id, "negative feedback");
    }

    // Immediate internal SMS to owner (skip if owner phone not configured)
    if (settings.my_phone) {
      await scheduleOwnerSMS(supabase, {
        to_phone: settings.my_phone,
        contact_id: contact_id ?? undefined,
        business_id,
        delaySeconds: 0,
        content:
          `Hey ${settings.my_name}, heads up — ${contact_first_name}${contact_phone ? ` (${contact_phone})` : ""} attempted to leave a negative review (${star_rating} stars or lower). We have blocked it from showing on your public page. Here is their feedback: ${feedback_text} (Do not reply to this message - not the client)`,
      });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[negative-feedback-received]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
