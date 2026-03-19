/**
 * one-year-followup-entry
 *
 * Trigger: POST webhook when:
 *   (a) A "client review plus one year followup sequence form" is submitted, OR
 *   (b) A "customer" tag is added to a contact
 *
 * Payload: { business_id, contact_id, contact_first_name }
 *
 * Kicks off the review-request-sequence (or review-link-check if GMB link missing)
 * AND schedules the one-year-referral-sequence starting at 23 days.
 *
 * Settings columns used: gmb_review_link
 */

import {
  addTag,
  corsHeaders,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  scheduleFunctionCall,
} from "../_shared/helpers.ts";

const REFERRAL_DELAY = 23 * 24 * 3600; // 23 days in seconds

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

    await addTag(supabase, contact_id, "customer");

    const referralPayload = {
      business_id,
      contact_id,
      contact_first_name,
      step: "sms1",
    };

    if (!settings.gmb_review_link) {
      // GMB link not yet set — poll via review-link-check until it's filled in
      await scheduleFunctionCall(supabase, {
        function_name: "review-link-check",
        contact_id,
        delaySeconds: 0,
        payload: { business_id, contact_id, contact_first_name },
      });
    } else {
      // GMB link ready — kick off review sequence immediately
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 0,
        payload: { business_id, contact_id, contact_first_name, step: "sms1" },
      });
    }

    // Referral nurture always starts at 23 days regardless of GMB link status
    await scheduleFunctionCall(supabase, {
      function_name: "one-year-referral-sequence",
      contact_id,
      delaySeconds: REFERRAL_DELAY,
      payload: referralPayload,
    });

    return jsonResponse({
      success: true,
      gmb_link_found: !!settings.gmb_review_link,
    });
  } catch (err) {
    console.error("[one-year-followup-entry]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
