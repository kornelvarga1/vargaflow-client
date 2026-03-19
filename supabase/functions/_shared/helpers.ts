import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function fetchSettings(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("business_id", businessId)
    .single();
  if (error) throw new Error(`Settings not found for business_id ${businessId}: ${error.message}`);
  return data;
}

export async function upsertContact(
  supabase: SupabaseClient,
  params: {
    full_name: string;
    phone: string;
    email?: string;
    business_id: string;
    lead_source?: string;
  },
) {
  const { data, error } = await supabase
    .from("contacts")
    .upsert(
      {
        full_name: params.full_name,
        phone: params.phone,
        email: params.email ?? null,
        business_id: params.business_id,
        lead_source: params.lead_source ?? "Other",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone,business_id" },
    )
    .select()
    .single();
  if (error) throw new Error(`Contact upsert failed: ${error.message}`);
  return data;
}

export async function addTag(supabase: SupabaseClient, contactId: string, tag: string) {
  const { data: contact, error: fetchErr } = await supabase
    .from("contacts")
    .select("tags")
    .eq("id", contactId)
    .single();
  if (fetchErr) throw new Error(`Failed to fetch contact tags: ${fetchErr.message}`);

  const tags: string[] = contact?.tags ?? [];
  if (tags.includes(tag)) return;

  const { error } = await supabase
    .from("contacts")
    .update({ tags: [...tags, tag] })
    .eq("id", contactId);
  if (error) throw new Error(`Failed to add tag: ${error.message}`);
}

// Schedule an SMS to a contact — recipient phone resolved from contacts table by the queue processor
export async function scheduleContactSMS(
  supabase: SupabaseClient,
  params: { contact_id: string; content: string; delaySeconds: number },
) {
  const scheduledAt = new Date(Date.now() + params.delaySeconds * 1000).toISOString();
  const { error } = await supabase.from("message_queue").insert({
    contact_id: params.contact_id,
    message_content: params.content,
    message_type: "sms",
    scheduled_at: scheduledAt,
    status: "pending",
  });
  if (error) throw new Error(`scheduleContactSMS failed: ${error.message}`);
}

// Schedule an internal SMS to the owner (to_phone explicitly set, contact_id optional for audit)
export async function scheduleOwnerSMS(
  supabase: SupabaseClient,
  params: {
    to_phone: string;
    content: string;
    delaySeconds: number;
    contact_id?: string;
  },
) {
  const scheduledAt = new Date(Date.now() + params.delaySeconds * 1000).toISOString();
  const { error } = await supabase.from("message_queue").insert({
    contact_id: params.contact_id ?? null,
    to_phone: params.to_phone,
    message_content: params.content,
    message_type: "internal_sms",
    scheduled_at: scheduledAt,
    status: "pending",
  });
  if (error) throw new Error(`scheduleOwnerSMS failed: ${error.message}`);
}

// Schedule a function-call trigger row (e.g. marketing-form-reminder after 10 days)
export async function scheduleFunctionCall(
  supabase: SupabaseClient,
  params: {
    function_name: string;
    payload: Record<string, unknown>;
    delaySeconds: number;
    contact_id?: string;
  },
) {
  const scheduledAt = new Date(Date.now() + params.delaySeconds * 1000).toISOString();
  const { error } = await supabase.from("message_queue").insert({
    contact_id: params.contact_id ?? null,
    message_content: `FUNCTION_CALL:${params.function_name}`,
    message_type: "function_call",
    scheduled_at: scheduledAt,
    status: "pending",
    metadata: { function_name: params.function_name, payload: params.payload },
  });
  if (error) throw new Error(`scheduleFunctionCall failed: ${error.message}`);
}

// Send SMS immediately via Twilio REST API
// `from` should be settings.twilio_phone_number for the sending business
export async function sendSMSNow(to: string, body: string, from: string): Promise<void> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error: ${err}`);
  }
}

// Send a Facebook Messenger message via Graph API
export async function sendFBMessage(
  recipientId: string,
  message: string,
  pageAccessToken: string,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook Graph API error: ${err}`);
  }
}

// Send an Instagram DM via Graph API (identical endpoint, different token)
export async function sendIGMessage(
  recipientId: string,
  message: string,
  pageAccessToken: string,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram Graph API error: ${err}`);
  }
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
