/**
 * one-year-referral-sequence
 *
 * PURPOSE: Sends 5 referral/return-customer discount SMS messages over ~1 year,
 * with owner notifications and reply detection between each.
 * Called internally via scheduleFunctionCall.
 *
 * Steps: sms1 → check1 → sms2 → check2 → sms3 → check3 → sms4 → check4 → sms5 → check5 → final
 *
 * Reply detection: queries activity_log for activity_type='inbound_sms' for this contact
 * after `sms_sent_at` (passed in payload by each SMS step).
 *
 * Payload: { business_id, contact_id, contact_first_name, contact_phone?, step, sms_sent_at? }
 *
 * Settings columns used: my_name, company_name, website_url, my_phone, twilio_phone_number
 * Custom value: discount_amount (from custom_values table, key='discount_amount', business_id matches)
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
  contact_phone?: string;
  step: string;
  sms_sent_at?: string;
};

async function getDiscountAmount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  business_id: string,
): Promise<string> {
  const { data } = await supabase
    .from("custom_values")
    .select("value")
    .eq("key", "discount_amount")
    .eq("business_id", business_id)
    .maybeSingle();
  return data?.value ?? "a special discount";
}

async function hasReplied(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact_id: string,
  after: string,
): Promise<{ replied: boolean; replyText: string }> {
  const { data } = await supabase
    .from("activity_log")
    .select("description")
    .eq("contact_id", contact_id)
    .eq("activity_type", "inbound_sms")
    .gte("created_at", after)
    .order("created_at", { ascending: false })
    .limit(1);
  return {
    replied: (data?.length ?? 0) > 0,
    replyText: data?.[0]?.description ?? "",
  };
}

async function resolvePhone(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  contact_id: string,
  provided?: string,
): Promise<string> {
  if (provided) return provided;
  const { data } = await supabase
    .from("contacts")
    .select("phone")
    .eq("id", contact_id)
    .single();
  return data?.phone ?? "unknown";
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
    const { my_name, company_name, website_url, my_phone } = settings;

    // Resolve contact_phone — fetch from DB if not in payload, then carry it forward
    const contact_phone = await resolvePhone(supabase, contact_id, body.contact_phone);

    const nextPayload = (overrides: Partial<Payload> = {}): Payload => ({
      business_id,
      contact_id,
      contact_first_name,
      contact_phone,
      step: "",
      ...overrides,
    });

    const ownerReplyNotification = (replyText: string) =>
      `Hey ${my_name}, ${contact_first_name} just replied to your return/referral discount offer in the one-year follow-up sequence. Here is their response: ${replyText || "(no text captured)"}. You can reach them at ${contact_phone} if needed. (Do not reply - not the client)`;

    if (step === "sms1") {
      const discountAmount = await getDiscountAmount(supabase, business_id);
      const smsSentAt = new Date().toISOString();
      const vars1 = { first_name: contact_first_name, my_name: my_name ?? "", company_name: company_name ?? "", website_url: website_url ?? "", discount_amount: discountAmount };
      const tpl1 = await fetchClientTemplate(supabase, "one-year-referral-sequence", "sms1", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl1?.content ?? `Hey {{first_name}}, I am running a returning customer special this week and giving {{discount_amount}}. It's only for the first 3 people — so if you are interested or know someone who might be, just tap the link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}`,
          vars1,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "one-year-referral-sequence",
        contact_id,
        delaySeconds: 24 * 3600, // 24 hours
        payload: nextPayload({ step: "check1", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check1") {
      const { replied, replyText } = await hasReplied(supabase, contact_id, sms_sent_at!);
      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content: ownerReplyNotification(replyText),
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "one-year-referral-sequence",
          contact_id,
          delaySeconds: 8 * 7 * 24 * 3600, // 8 weeks
          payload: nextPayload({ step: "sms2" }),
        });
      }
    } else if (step === "sms2") {
      const discountAmount = await getDiscountAmount(supabase, business_id);
      const smsSentAt = new Date().toISOString();
      const vars2 = { first_name: contact_first_name, my_name: my_name ?? "", company_name: company_name ?? "", website_url: website_url ?? "", discount_amount: discountAmount };
      const tpl2 = await fetchClientTemplate(supabase, "one-year-referral-sequence", "sms2", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl2?.content ?? `Hey {{first_name}}, I am running a limited time special for the next 6 days and giving {{discount_amount}}. So if you are interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}`,
          vars2,
        ),
      });
      await scheduleOwnerSMS(supabase, {
        to_phone: my_phone,
        contact_id,
        delaySeconds: 0,
        content:
          `Hey ${my_name}, it's been about 3 months since you added ${contact_first_name} into your one-year follow-up sequence. We just sent them a little discount offer to ask for referrals. Their number is ${contact_phone} if you want to reach out. (Do not reply - not the client)`,
      });
      await scheduleFunctionCall(supabase, {
        function_name: "one-year-referral-sequence",
        contact_id,
        delaySeconds: 24 * 3600, // 24 hours
        payload: nextPayload({ step: "check2", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check2") {
      const { replied, replyText } = await hasReplied(supabase, contact_id, sms_sent_at!);
      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content: ownerReplyNotification(replyText),
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "one-year-referral-sequence",
          contact_id,
          delaySeconds: 3 * 30 * 24 * 3600, // ~3 months
          payload: nextPayload({ step: "sms3" }),
        });
      }
    } else if (step === "sms3") {
      const discountAmount = await getDiscountAmount(supabase, business_id);
      const smsSentAt = new Date().toISOString();
      const vars3 = { first_name: contact_first_name, my_name: my_name ?? "", company_name: company_name ?? "", website_url: website_url ?? "", discount_amount: discountAmount };
      const tpl3 = await fetchClientTemplate(supabase, "one-year-referral-sequence", "sms3", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl3?.content ?? `Hey {{first_name}}, I am running a loyalty special this week and giving {{discount_amount}}. It's only for the first 3 people — so if you are interested or know someone who might be, just tap the link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}`,
          vars3,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "one-year-referral-sequence",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: nextPayload({ step: "check3", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check3") {
      const { replied, replyText } = await hasReplied(supabase, contact_id, sms_sent_at!);
      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content: ownerReplyNotification(replyText),
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "one-year-referral-sequence",
          contact_id,
          delaySeconds: 3 * 30 * 24 * 3600, // ~3 months
          payload: nextPayload({ step: "sms4" }),
        });
      }
    } else if (step === "sms4") {
      const discountAmount = await getDiscountAmount(supabase, business_id);
      const smsSentAt = new Date().toISOString();
      const vars4 = { first_name: contact_first_name, my_name: my_name ?? "", company_name: company_name ?? "", website_url: website_url ?? "", discount_amount: discountAmount };
      const tpl4 = await fetchClientTemplate(supabase, "one-year-referral-sequence", "sms4", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl4?.content ?? `Hey {{first_name}}, I am running a referral special this week and giving {{discount_amount}} on referrals. It's only for the first 4 people — so if you are interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}`,
          vars4,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "one-year-referral-sequence",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: nextPayload({ step: "check4", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check4") {
      const { replied, replyText } = await hasReplied(supabase, contact_id, sms_sent_at!);
      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content: ownerReplyNotification(replyText),
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "one-year-referral-sequence",
          contact_id,
          delaySeconds: 3 * 30 * 24 * 3600, // ~3 months
          payload: nextPayload({ step: "sms5" }),
        });
      }
    } else if (step === "sms5") {
      const discountAmount = await getDiscountAmount(supabase, business_id);
      const smsSentAt = new Date().toISOString();
      const vars5 = { first_name: contact_first_name, my_name: my_name ?? "", company_name: company_name ?? "", website_url: website_url ?? "", discount_amount: discountAmount };
      const tpl5 = await fetchClientTemplate(supabase, "one-year-referral-sequence", "sms5", business_id);
      await scheduleContactSMS(supabase, {
        contact_id,
        business_id,
        delaySeconds: 0,
        content: resolveClientTemplate(
          tpl5?.content ?? `Hey {{first_name}}, I am running an anniversary special giving {{discount_amount}}. It's only for the next 6 days — so if you're interested or know someone who might be, just tap this link: {{website_url}}/getyourdiscount {{my_name}} from {{company_name}}`,
          vars5,
        ),
      });
      await scheduleFunctionCall(supabase, {
        function_name: "one-year-referral-sequence",
        contact_id,
        delaySeconds: 24 * 3600,
        payload: nextPayload({ step: "check5", sms_sent_at: smsSentAt }),
      });
    } else if (step === "check5") {
      const { replied, replyText } = await hasReplied(supabase, contact_id, sms_sent_at!);
      if (replied) {
        await scheduleOwnerSMS(supabase, {
          to_phone: my_phone,
          contact_id,
          delaySeconds: 0,
          content: ownerReplyNotification(replyText),
        });
      } else {
        await scheduleFunctionCall(supabase, {
          function_name: "one-year-referral-sequence",
          contact_id,
          delaySeconds: 0,
          payload: nextPayload({ step: "final" }),
        });
      }
    } else if (step === "final") {
      await scheduleOwnerSMS(supabase, {
        to_phone: my_phone,
        contact_id,
        delaySeconds: 0,
        content:
          `Hey ${my_name}, it's been about a year since we added ${contact_first_name} to your one-year follow-up sequence for referral/return customer discounts. We are removing them from further follow-up. If you want to contact them for a referral or to see if they would like to use your services again, please reach them at ${contact_phone}. (Do not reply - not the client)`,
      });
    } else {
      console.warn(`[one-year-referral-sequence] Unknown step: ${step}`);
    }

    return jsonResponse({ success: true, step });
  } catch (err) {
    console.error("[one-year-referral-sequence]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
