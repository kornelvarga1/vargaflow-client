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
  fetchSettings,
  getFirstName,
  getSupabaseAdmin,
  jsonResponse,
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

    // SMS to contact — 2 minutes
    await scheduleContactSMS(supabase, {
      contact_id,
      business_id,
      delaySeconds: 120,
      content:
        `Hey ${contact_first_name}, just got your discounted job request. I will be in touch shortly and get you that discount. ${settings.my_name} from ${settings.company_name}`,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[discount-form-submission]", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
