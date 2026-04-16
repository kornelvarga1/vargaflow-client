/**
 * one-year-followup-entry
 *
 * Trigger: POST webhook when:
 *   (a) A "client review plus one year followup sequence form" is submitted, OR
 *   (b) A "customer" tag is added to a contact
 *
 * Payload: { business_id, contact_first_name, contact_phone, contact_id? }
 *
 * contact_id is optional — if omitted the contact is upserted by phone number first.
 * This allows the job-complete-form (which only has name + phone) to call this
 * function directly without pre-creating a contact.
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
  upsertContact,
} from "../_shared/helpers.ts";

const REFERRAL_DELAY = 23 * 24 * 3600; // 23 days in seconds

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_first_name: string;
      contact_phone?: string;
      contact_id?: string;
    };

    console.log("[one-year-followup-entry] received body:", JSON.stringify(body));

    const { business_id, contact_first_name } = body;
    const contact_phone = body.contact_phone;
    let contact_id = body.contact_id;

    if (!business_id) throw new Error("Missing required field: business_id");
    if (!contact_first_name) throw new Error("Missing required field: contact_first_name");

    const supabase = getSupabaseAdmin();

    // ── Resolve contact ──────────────────────────────────────────
    // If no contact_id supplied (e.g. called from job-complete-form),
    // upsert the contact by phone to obtain one.
    if (!contact_id) {
      if (!contact_phone) throw new Error("Must provide either contact_id or contact_phone");

      console.log("[one-year-followup-entry] upserting contact for phone:", contact_phone);
      const contact = await upsertContact(supabase, {
        full_name: contact_first_name,
        phone: contact_phone,
        business_id,
        lead_source: "Job Complete Form",
      });
      contact_id = contact.id;
      console.log("[one-year-followup-entry] resolved contact_id:", contact_id);
    }

    // ── Fetch settings ───────────────────────────────────────────
    console.log("[one-year-followup-entry] fetching settings for business_id:", business_id);
    const settings = await fetchSettings(supabase, business_id);
    console.log("[one-year-followup-entry] gmb_review_link:", settings.gmb_review_link || "(empty)");

    // ── Tag contact ──────────────────────────────────────────────
    console.log("[one-year-followup-entry] adding tag 'customer' to contact:", contact_id);
    await addTag(supabase, contact_id, "customer");

    const referralPayload = {
      business_id,
      contact_id,
      contact_first_name,
      contact_phone: contact_phone ?? null,
      step: "sms1",
    };

    // ── Schedule review sequence ─────────────────────────────────
    if (!settings.gmb_review_link) {
      console.log("[one-year-followup-entry] GMB link missing — scheduling review-link-check");
      await scheduleFunctionCall(supabase, {
        function_name: "review-link-check",
        contact_id,
        delaySeconds: 0,
        payload: { business_id, contact_id, contact_first_name },
      });
    } else {
      console.log("[one-year-followup-entry] GMB link present — scheduling review-request-sequence");
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 0,
        payload: { business_id, contact_id, contact_first_name, step: "sms1" },
      });
    }

    // ── Schedule referral nurture (always at 23 days) ────────────
    console.log("[one-year-followup-entry] scheduling one-year-referral-sequence at 23 days");
    await scheduleFunctionCall(supabase, {
      function_name: "one-year-referral-sequence",
      contact_id,
      delaySeconds: REFERRAL_DELAY,
      payload: referralPayload,
    });

    console.log("[one-year-followup-entry] success for contact_id:", contact_id);
    return jsonResponse({
      success: true,
      contact_id,
      gmb_link_found: !!settings.gmb_review_link,
    });
  } catch (err) {
    const error = err as Error;
    console.error("[one-year-followup-entry] ERROR:", error?.message ?? String(err));
    console.error("[one-year-followup-entry] STACK:", error?.stack ?? "(no stack)");
    console.error("[one-year-followup-entry] RAW:", JSON.stringify(err));
    return jsonResponse({ error: error?.message ?? String(err) }, 500);
  }
});
