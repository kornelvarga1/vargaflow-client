/**
 * review-link-clicked
 *
 * Trigger: GET request from a customer clicking a review link in an SMS
 * Query params: ?contact_id=xxx&business_id=xxx
 *
 * Logs the click to activity_log, then 302-redirects the customer to the
 * business's Google review link (gmb_review_link from settings).
 *
 * verify_jwt = false — no auth needed, customers click from SMS
 */

import { fetchSettings, getSupabaseAdmin } from "../_shared/helpers.ts";

const FALLBACK_URL = "https://www.google.com/search?q=leave+a+review";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const contact_id = url.searchParams.get("contact_id");
  const business_id = url.searchParams.get("business_id");

  if (!business_id) {
    return Response.redirect(FALLBACK_URL, 302);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Log the click (best-effort — only if we have a contact_id)
    if (contact_id) {
      await supabase.from("activity_log").insert({
        contact_id,
        business_id,
        activity_type: "review_link_clicked",
        description: "Customer clicked the Google review link",
      });
    }

    const settings = await fetchSettings(supabase, business_id);
    const destination = settings?.gmb_review_link ?? FALLBACK_URL;

    return Response.redirect(destination, 302);
  } catch (err) {
    console.error("[review-link-clicked]", err);
    return Response.redirect(FALLBACK_URL, 302);
  }
});
