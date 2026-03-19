/**
 * review-link-check
 *
 * PURPOSE: Polls until settings.gmb_review_link is populated, then kicks off
 * review-request-sequence. Called internally by the message_queue cron processor.
 *
 * If gmb_review_link is still empty, reschedules itself in 24 hours.
 * If populated, fires review-request-sequence/sms1 immediately.
 *
 * Payload: { business_id, contact_id, contact_first_name }
 *
 * Settings columns used: gmb_review_link
 */

import {
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  scheduleFunctionCall,
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

    if (settings.gmb_review_link) {
      // Link is populated — kick off the review request sequence
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 0,
        payload: { business_id, contact_id, contact_first_name, step: "sms1" },
      });
    } else {
      // Still empty — check again in 24 hours
      await scheduleFunctionCall(supabase, {
        function_name: "review-link-check",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: { business_id, contact_id, contact_first_name },
      });
    }

    return jsonResponse({ success: true, gmb_link_found: !!settings.gmb_review_link });
  } catch (err) {
    console.error("[review-link-check]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
