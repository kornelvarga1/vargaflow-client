/**
 * db-reactivation
 *
 * PURPOSE: Database reactivation sequence. Sends an email + SMS to a dormant
 * contact with a special offer, then follows up once if no reply.
 *
 * Steps: initial → check1 → followup → check2
 *
 * Reply detection: queries activity_log for activity_type='inbound_sms' for
 * this contact after `sms_sent_at` (carried in payload by each outbound step).
 *
 * Email is sent via Resend (https://resend.com). Requires RESEND_API_KEY env var.
 *
 * Payload: { business_id, contact_id, contact_first_name, contact_phone,
 *            contact_email, step, sms_sent_at? }
 *
 * Settings columns used: my_name, company_name, my_email, my_phone, twilio_phone_number
 * Custom value: reactivation_offer (custom_values, key='reactivation_offer', business_id matches)
 */

import {
  corsHeaders,
  fetchClientTemplate,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  resolveClientTemplate,
  scheduleFunctionCall,
  scheduleOwnerSMS,
  sendSMSNow,
} from "../_shared/helpers.ts";

type Payload = {
  business_id: string;
  contact_id: string;
  contact_first_name: string;
  contact_phone: string;
  contact_email: string;
  step: string;
  sms_sent_at?: string;
};

async function getReactivationOffer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  business_id: string,
): Promise<string> {
  const { data } = await supabase
    .from("custom_values")
    .select("value")
    .eq("key", "reactivation_offer")
    .eq("business_id", business_id)
    .maybeSingle();
  return data?.value ?? "a special offer";
}

async function hasReplied(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact_id: string,
  after: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("activity_log")
    .select("id")
    .eq("contact_id", contact_id)
    .eq("activity_type", "inbound_sms")
    .gte("created_at", after)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function sendEmail(params: {
  to: string;
  from: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as Payload;
    const {
      business_id,
      contact_id,
      contact_first_name,
      contact_phone,
      contact_email,
      step,
      sms_sent_at,
    } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);
    const { my_name, company_name, my_email, my_phone, twilio_phone_number } = settings;

    const nextPayload = (overrides: Partial<Payload> = {}): Payload => ({
      business_id,
      contact_id,
      contact_first_name,
      contact_phone,
      contact_email,
      step: "",
      ...overrides,
    });

    if (step === "initial") {
      const offer = await getReactivationOffer(supabase, business_id);
      const smsSentAt = new Date().toISOString();

      const vars = {
        first_name: contact_first_name,
        my_name: my_name ?? "",
        company_name: company_name ?? "",
        contact_phone: contact_phone ?? "",
        reactivation_offer: offer,
      };

      // Email to contact
      const emailTpl = await fetchClientTemplate(supabase, "db-reactivation", "email_initial", business_id);
      await sendEmail({
        to: contact_email,
        from: my_email,
        subject: `${contact_first_name}, you there?`,
        text: resolveClientTemplate(
          emailTpl?.content ?? `Hey {{first_name}}, I tried to text you at {{contact_phone}}. Wanted to reach out because my team and I are doing a {{reactivation_offer}} this week. Only catch is we can only bring on three clients while supplies last. Thought you might be interested. Let me know — no worries either way. {{my_name}} from {{company_name}}`,
          vars,
        ),
      });

      // Immediate SMS to contact
      const smsTpl = await fetchClientTemplate(supabase, "db-reactivation", "sms_initial", business_id);
      await sendSMSNow(
        contact_phone,
        resolveClientTemplate(
          smsTpl?.content ?? `Hey {{first_name}}, wanted to reach out because my team and I are doing a {{reactivation_offer}} this week. Only catch is we can only bring on three clients while supplies last. You might be interested — let me know, no worries either way. {{my_name}}`,
          vars,
        ),
        twilio_phone_number,
      );

      // Schedule check1 after 24 hours
      await scheduleFunctionCall(supabase, {
        function_name: "db-reactivation",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: nextPayload({ step: "check1", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check1") {
      const replied = await hasReplied(supabase, contact_id, sms_sent_at!);

      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content:
            `Hey ${my_name}, ${contact_first_name} just replied to your reactivation offer. Here is their response. You can reach them at ${contact_phone} if needed. (Do not reply - not the client)`,
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "db-reactivation",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "followup" }),
        });
      }
    } else if (step === "followup") {
      const smsSentAt = new Date().toISOString();

      const followupVars = {
        first_name: contact_first_name,
        my_name: my_name ?? "",
      };

      // Immediate follow-up SMS to contact
      const followupTpl = await fetchClientTemplate(supabase, "db-reactivation", "sms_followup", business_id);
      await sendSMSNow(
        contact_phone,
        resolveClientTemplate(
          followupTpl?.content ?? `Hey {{first_name}}, did you get my text yesterday? Only have two spots left for the offer. Let me know if I should save you a spot while we have the extra supplies — respond back with yes or no so I know whether to save your spot or not. Enjoy your day. {{my_name}}`,
          followupVars,
        ),
        twilio_phone_number,
      );

      // Schedule check2 after 24 hours
      await scheduleFunctionCall(supabase, {
        function_name: "db-reactivation",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: nextPayload({ step: "check2", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check2") {
      const replied = await hasReplied(supabase, contact_id, sms_sent_at!);

      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content:
            `Hey ${my_name}, ${contact_first_name} just replied to your reactivation follow-up. Here is their response. You can reach them at ${contact_phone} if needed. (Do not reply - not the client)`,
        });
      }
      // No reply — sequence ends silently
    } else {
      console.warn(`[db-reactivation] Unknown step: ${step}`);
    }

    return jsonResponse({ success: true, step });
  } catch (err) {
    console.error("[db-reactivation]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
