/**
 * discount-form-submission
 *
 * Trigger: POST webhook when a discount form is submitted
 * Payload: { business_id, contact_id, contact_first_name, contact_phone, contact_message }
 *
 * Settings columns used: my_name, my_phone, company_name, twilio_phone_number
 */

import {
  addTag,
  corsHeaders,
  fetchClientTemplate,
  fetchSettings,
  getFirstName,
  getSupabaseAdmin,
  jsonResponse,
  resolveClientTemplate,
  scheduleContactSMS,
  scheduleOwnerSMS,
  upsertContact,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      business_id: string;
      contact_name: string;
      contact_phone: string;
      message: string;
    };

    const { business_id, contact_name, contact_phone, message } = body;
    if (!business_id || !contact_name || !contact_phone) {
      return jsonResponse({ error: "Missing required fields: business_id, contact_name, contact_phone" }, 400);
    }

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);

    const contact = await upsertContact(supabase, {
      full_name: contact_name,
      phone: contact_phone,
      business_id,
      lead_source: "Discount Form",
    });

    const contact_id = contact.id;
    const contact_first_name = getFirstName(contact_name);

    await addTag(supabase, contact_id, "discount-form-lead");

    // Immediate internal SMS to owner
    await scheduleOwnerSMS(supabase, {
      to_phone: settings.my_phone,
      contact_id,
      delaySeconds: 0,
      content:
        `Hey ${settings.my_name}, ${contact_first_name} just filled out your disc form on the website. Info: Name: ${contact_name}, Phone: ${contact_phone}, Message: ${message}. We have told them you will be reaching out soon. (Do not reply to this message - not the client)`,
    });

    const vars = {
      first_name: contact_first_name,
      my_name: settings.my_name ?? "",
      company_name: settings.company_name ?? "",
    };

    // SMS to contact — 2 minutes
    const tpl1 = await fetchClientTemplate(supabase, "discount-form-submission", "sms1", business_id);
    await scheduleContactSMS(supabase, {
      contact_id,
      business_id,
      delaySeconds: 120,
      content: resolveClientTemplate(
        tpl1?.content ?? `Hey {{first_name}}, just got your discounted job request. I will be in touch shortly and get you that discount. {{my_name}} from {{company_name}}`,
        vars,
      ),
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[discount-form-submission]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
