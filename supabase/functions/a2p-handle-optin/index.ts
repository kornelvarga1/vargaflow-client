/**
 * a2p-handle-optin
 *
 * Trigger: POST webhook when a contact replies via SMS with an opt-in phrase.
 * Clears the dnd_sms flag on the contact so they can receive messages again.
 *
 * Payload: { business_id, contact_id, reply_phrase }
 *
 * Recognised opt-in phrases: "start", "join", "help", "info"
 */

import {
  corsHeaders,
  getSupabaseAdmin,
  jsonResponse,
} from "../_shared/helpers.ts";

const OPT_IN_PHRASES = new Set(["start", "join", "help", "info"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_id: string;
      reply_phrase: string;
    };

    const { business_id, contact_id, reply_phrase } = body;

    if (!OPT_IN_PHRASES.has(reply_phrase?.toLowerCase?.().trim())) {
      return jsonResponse({ success: true, action: "ignored", reply_phrase });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("contacts")
      .update({ dnd_sms: false })
      .eq("id", contact_id)
      .eq("business_id", business_id);

    if (error) throw new Error(`Failed to clear dnd_sms: ${error.message}`);

    return jsonResponse({ success: true, action: "opted_in", contact_id });
  } catch (err) {
    console.error("[a2p-handle-optin]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
