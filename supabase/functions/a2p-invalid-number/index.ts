/**
 * a2p-invalid-number
 *
 * Trigger: POST webhook when a Twilio messaging error indicates an invalid/
 * unreachable number (error codes: 30003, 30004, 30005, 30006) or a number
 * validation failure. Sets dnd_sms = TRUE to suppress all future outbound SMS.
 *
 * Payload: { business_id, contact_id }
 */

import {
  corsHeaders,
  getSupabaseAdmin,
  jsonResponse,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_id: string;
    };

    const { business_id, contact_id } = body;

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("contacts")
      .update({ dnd_sms: true })
      .eq("id", contact_id)
      .eq("business_id", business_id);

    if (error) throw new Error(`Failed to set dnd_sms: ${error.message}`);

    return jsonResponse({ success: true, contact_id });
  } catch (err) {
    console.error("[a2p-invalid-number]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
