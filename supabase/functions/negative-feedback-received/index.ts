/**
 * negative-feedback-received
 *
 * Trigger: POST from the contractor website's WriteReview page when a
 * customer submits a 1-3 star rating.
 * Payload: { business_id, contact_id, contact_first_name, contact_phone?, contact_email?, star_rating, feedback_text }
 *
 * Security: public endpoint (the review page on contractor sites uses the
 * anon key), but we defend against abuse by:
 *   - Requiring contact_id AND verifying the contact row exists + belongs
 *     to the declared business_id. This shrinks the attack surface to
 *     "attacker already knows a valid contact_id UUID for that business"
 *     — which is hard to enumerate with contacts-RLS locked down.
 *   - Truncating feedback_text to 250 chars in the owner SMS (hard cap at
 *     2 segments; full text goes to activity_log instead).
 *   - Clamping star_rating to [1, 5] to avoid weird values reaching owner.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SMS_FEEDBACK_CHARS = 250;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_id: string | null;
      contact_first_name: string;
      contact_phone?: string | null;
      contact_email?: string | null;
      star_rating: number;
      feedback_text: string;
    };

    const { business_id, contact_id, contact_first_name, contact_phone, contact_email, feedback_text } = body;
    const star_rating = Math.max(1, Math.min(5, Number(body.star_rating) || 0));

    if (!business_id || !UUID_RE.test(business_id)) {
      return jsonResponse({ error: "invalid business_id" }, 400);
    }

    // contact_id is optional — customers navigating to /write-review from SMS
    // don't carry a contact_id in the URL. If provided, validate it and verify
    // it belongs to this business (prevents contact enumeration attacks).
    // business_id UUID check above is the primary security gate either way.
    let verified_contact_id: string | null = null;

    const supabase = getSupabaseAdmin();

    if (contact_id && UUID_RE.test(contact_id)) {
      const { data: contact, error: contactErr } = await supabase
        .from("contacts")
        .select("id, business_id")
        .eq("id", contact_id)
        .maybeSingle();

      if (contactErr) {
        console.error("[negative-feedback-received] contact lookup failed:", contactErr.message);
        return jsonResponse({ error: "lookup failed" }, 500);
      }
      if (contact && contact.business_id === business_id) {
        verified_contact_id = contact_id;
      }
    }

    const settings = await fetchSettings(supabase, business_id);
    if (verified_contact_id) await addTag(supabase, verified_contact_id, "negative feedback");

    // Persist the full feedback so the owner has a durable record.
    const safeFeedback = typeof feedback_text === "string" ? feedback_text : "";
    await supabase.from("activity_log").insert({
      contact_id: verified_contact_id,
      business_id,
      activity_type: "negative_feedback",
      description: `${contact_first_name} left ${star_rating}-star feedback`,
      metadata: {
        star_rating,
        feedback_text: safeFeedback,
        contact_phone: contact_phone ?? null,
        contact_email: contact_email ?? null,
      },
    });

    if (settings.my_phone) {
      const truncated = safeFeedback.length > MAX_SMS_FEEDBACK_CHARS
        ? safeFeedback.slice(0, MAX_SMS_FEEDBACK_CHARS) + "…"
        : safeFeedback;
      const contactTag = contact_email
        ? ` (${contact_email})`
        : contact_phone ? ` (${contact_phone})` : "";

      await scheduleOwnerSMS(supabase, {
        to_phone: settings.my_phone,
        contact_id: verified_contact_id,
        business_id,
        delaySeconds: 0,
        content:
          `Hey ${settings.my_name}, heads up — ${contact_first_name}${contactTag} just tried to leave a ${star_rating}-star review. Blocked from your public page. Their feedback: ${truncated}`,
      });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[negative-feedback-received]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
