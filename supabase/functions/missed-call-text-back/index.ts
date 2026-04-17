/**
 * missed-call-text-back
 *
 * Handles two Twilio webhooks for the same URL:
 *
 * 1. "A call comes in" (initial webhook) — CallStatus is absent or "ringing".
 *    Returns TwiML to play a brief message then hang up.
 *
 * 2. "Call status changes" (status callback) — CallStatus is a final status.
 *    Queues two SMS messages to the caller if the call was missed.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import {
  addTag,
  corsHeaders,
  fetchClientTemplate,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  resolveClientTemplate,
  scheduleContactSMS,
  upsertContact,
  validateTwilioSignature,
} from "../_shared/helpers.ts";

const MISSED_STATUSES = new Set(["busy", "canceled", "voicemail", "no-answer", "completed"]);

const twimlResponse = (xml: string) =>
  new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Twilio sends application/x-www-form-urlencoded, not JSON
    const formData = await req.formData();
    const get = (key: string) => formData.get(key)?.toString() ?? "";

    // Validate Twilio signature — public endpoint (verify_jwt=false).
    const paramObj: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v === "string") paramObj[k] = v;
    }
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const signature = req.headers.get("X-Twilio-Signature");
    const valid = await validateTwilioSignature(authToken, signature, req.url, paramObj);
    if (!valid) {
      console.warn("[missed-call-text-back] invalid Twilio signature — rejecting");
      return new Response("Forbidden", { status: 403 });
    }

    const To = get("To");
    const From = get("From");
    const CallStatus = get("CallStatus");

    console.log(`[missed-call-text-back] To="${To}" From="${From}" CallStatus="${CallStatus}"`);

    // ── Scenario 1: Initial "call comes in" webhook ───────────────────────────
    // CallStatus is absent or "ringing" — return TwiML, do not queue SMS yet.
    if (!CallStatus || CallStatus === "ringing") {
      return twimlResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry we missed your call. We'll text you shortly.</Say>
  <Hangup/>
</Response>`,
      );
    }

    // ── Scenario 2: "Call status changes" callback ────────────────────────────
    // Normalize CallStatus — Twilio may send "no-answer" or "noAnswer"
    const normalizedStatus = CallStatus.toLowerCase().replace("noanswer", "no-answer");
    if (!MISSED_STATUSES.has(normalizedStatus)) {
      return jsonResponse({ skipped: true, reason: `CallStatus "${CallStatus}" is not a missed-call status` });
    }

    const supabase = getSupabaseAdmin();

    // Dedup: check if we already processed this call (Twilio can fire multiple status callbacks)
    const CallSid = get("CallSid");
    if (CallSid) {
      const { error: dupError } = await supabase
        .from("processed_webhooks")
        .insert({ event_id: `missed-call-${CallSid}` });
      if (dupError) {
        console.log(`[missed-call-text-back] Already processed CallSid=${CallSid}, skipping`);
        return jsonResponse({ skipped: true, reason: "duplicate callback" });
      }
    }

    // Resolve business_id: prefer query param, otherwise look up by Twilio phone number
    const urlParams = new URL(req.url).searchParams;
    let business_id = urlParams.get("business_id") ?? "";

    if (!business_id && To) {
      console.log(`[missed-call-text-back] Looking up business by To number: "${To}"`);
      const { data } = await supabase
        .from("settings")
        .select("business_id, twilio_phone_number")
        .eq("twilio_phone_number", To)
        .maybeSingle();
      console.log(`[missed-call-text-back] settings row found: ${JSON.stringify(data)}`);
      business_id = data?.business_id ?? "";
    }

    if (!business_id) {
      return jsonResponse({ error: `No business found for number ${To}` }, 400);
    }

    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: From,
      phone: From,
      business_id,
      lead_source: "Missed Call",
    });

    await addTag(supabase, contact.id, "missed-call");

    const vars = {
      my_name: settings.my_name ?? "",
      company_name: settings.company_name ?? "",
      quote_form_link: settings.quote_form_link ?? "",
    };

    // Message 1 — 1 minute delay
    const tpl1 = await fetchClientTemplate(supabase, "missed-call-text-back", "sms1", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 60,
      content: resolveClientTemplate(
        tpl1?.content ?? `Hey, sorry I missed you. I will get back to you as soon as possible. If you want to give me a few details about the job, that would be great. You can click this link for a free quote: {{quote_form_link}} — {{my_name}} from {{company_name}}`,
        vars,
      ),
    });

    // Message 2 — 3 minutes delay
    const tpl2 = await fetchClientTemplate(supabase, "missed-call-text-back", "sms2", business_id);
    await scheduleContactSMS(supabase, {
      contact_id: contact.id,
      business_id,
      delaySeconds: 180,
      content: resolveClientTemplate(
        tpl2?.content ?? `Look forward to hearing from you. In the meantime, are there any questions I can answer here for you?`,
        vars,
      ),
    });

    return jsonResponse({ success: true, contact_id: contact.id });
  } catch (err) {
    console.error("[missed-call-text-back]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
