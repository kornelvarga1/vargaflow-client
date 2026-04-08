/**
 * review-request-sequence
 *
 * PURPOSE: Multi-step review request sequence sent over ~1 month.
 * Called internally via scheduleFunctionCall with a `step` param.
 *
 * Steps: sms1 → check1 → sms2 → check2 → sms3 → check3 → sms4 → check4 → notify_owner
 *
 * Link-click detection: queries activity_log for activity_type='review_link_clicked'
 * for this contact after `sms_sent_at` (carried in payload by each SMS step).
 *
 * Payload: { business_id, contact_id, contact_first_name, step, sms_sent_at? }
 *
 * Settings columns used: my_name, company_name, gmb_review_link, my_phone, twilio_phone_number
 */

import {
  corsHeaders,
  fetchClientTemplate,
  fetchSettings,
  getSupabaseAdmin,
  jsonResponse,
  resolveClientTemplate,
  scheduleContactSMS,
  scheduleFunctionCall,
  scheduleOwnerSMS,
} from "../_shared/helpers.ts";

type Payload = {
  business_id: string;
  contact_id: string;
  contact_first_name: string;
  step: string;
  sms_sent_at?: string;
};

async function wasLinkClicked(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact_id: string,
  after: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("activity_log")
    .select("id")
    .eq("contact_id", contact_id)
    .eq("activity_type", "review_link_clicked")
    .gte("created_at", after)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as Payload;
    const { business_id, contact_id, contact_first_name, step, sms_sent_at } = body;

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);
    const { my_name, company_name, gmb_review_link, my_phone } = settings;

    const nextPayload = (overrides: Partial<Payload> = {}): Payload => ({
      business_id,
      contact_id,
      contact_first_name,
      step: "",
      ...overrides,
    });

    const reviewLink = `https://zfmchywjmgykmlhjihls.supabase.co/functions/v1/review-link-clicked?contact_id=${contact_id}&business_id=${business_id}`;
    const reviewVars = {
      first_name: contact_first_name,
      my_name: my_name ?? "",
      company_name: company_name ?? "",
      review_link: reviewLink,
    };

    if (step === "sms1") {
      const smsSentAt = new Date().toISOString();
      const tpl = await fetchClientTemplate(supabase, "review-request-sequence", "sms1", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl?.content ?? `Hey {{first_name}}, this is {{my_name}}. I hope you had a great experience with {{company_name}}. We donate a meal to charity for every customer who takes 10 seconds to leave a review. Here is the link: {{review_link}}`,
          reviewVars,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 4 * 24 * 3600, // 4 days
        payload: nextPayload({ step: "check1", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check1") {
      const clicked = await wasLinkClicked(supabase, contact_id, sms_sent_at!);
      if (!clicked) {
        await scheduleFunctionCall(supabase, {
          function_name: "review-request-sequence",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "sms2" }),
        });
      }
    } else if (step === "sms2") {
      const smsSentAt = new Date().toISOString();
      const tpl = await fetchClientTemplate(supabase, "review-request-sequence", "sms2", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl?.content ?? `Hey {{first_name}}, I wanted to follow up because I saw you haven't left a review yet. We donate a meal to charity for every customer that leaves a review. If you have 10 seconds to help someone you know or don't know, you are our kind of people. Click here: {{review_link}} PS - just say 'bye' if you want me to stop texting you`,
          reviewVars,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 7 * 24 * 3600, // 7 days
        payload: nextPayload({ step: "check2", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check2") {
      const clicked = await wasLinkClicked(supabase, contact_id, sms_sent_at!);
      if (!clicked) {
        await scheduleFunctionCall(supabase, {
          function_name: "review-request-sequence",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "sms3" }),
        });
      }
    } else if (step === "sms3") {
      const smsSentAt = new Date().toISOString();
      const tpl = await fetchClientTemplate(supabase, "review-request-sequence", "sms3", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl?.content ?? `Little review reminder in case you got extra busy this week. (We give a free meal to someone in need for each new review.) Here is the link again: {{review_link}}`,
          reviewVars,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 7 * 24 * 3600, // 7 days
        payload: nextPayload({ step: "check3", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check3") {
      const clicked = await wasLinkClicked(supabase, contact_id, sms_sent_at!);
      if (!clicked) {
        await scheduleFunctionCall(supabase, {
          function_name: "review-request-sequence",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "sms4" }),
        });
      }
    } else if (step === "sms4") {
      const smsSentAt = new Date().toISOString();
      const tpl = await fetchClientTemplate(supabase, "review-request-sequence", "sms4", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl?.content ?? `Hey {{first_name}}, this is the last time I will request a review from you, I promise. If you have a sec to leave one, we will donate a meal to a person in need. Here's the link — and thanks for helping those in need: {{review_link}}`,
          reviewVars,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "review-request-sequence",
        contact_id,
        delaySeconds: 48 * 3600, // 48 hours
        payload: nextPayload({ step: "check4", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check4") {
      const clicked = await wasLinkClicked(supabase, contact_id, sms_sent_at!);
      if (!clicked) {
        await scheduleFunctionCall(supabase, {
          function_name: "review-request-sequence",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "notify_owner" }),
        });
      }
    } else if (step === "notify_owner") {
      await scheduleOwnerSMS(supabase, {
        to_phone: my_phone,
        contact_id,
        delaySeconds: 0,
        content:
          `Hey ${my_name}, we have attempted to get ${contact_first_name} to leave you a review 4 times over the course of the last month. Try to get in touch with them directly to leave your review — they will have the link in their text messages. Here is your direct review link again: https://zfmchywjmgykmlhjihls.supabase.co/functions/v1/review-link-clicked?contact_id=${contact_id}&business_id=${business_id}`,
      });
    } else {
      console.warn(`[review-request-sequence] Unknown step: ${step}`);
    }

    return jsonResponse({ success: true, step });
  } catch (err) {
    console.error("[review-request-sequence]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
