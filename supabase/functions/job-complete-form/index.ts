/**
 * job-complete-form
 *
 * Serves a standalone HTML page the contractor fills out after every completed
 * job. Submitting triggers the review-request + 1-year follow-up sequence for
 * the customer via the one-year-followup-entry edge function.
 *
 * URL param: business_id
 * Returns:   text/html
 * Auth:      verify_jwt = false (public — contractor uses on-site on their phone)
 *
 * Settings columns used: company_name, brand_color, my_name
 */

import { fetchSettings, getSupabaseAdmin } from "../_shared/helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const url = new URL(req.url);
    const business_id = url.searchParams.get("business_id");

    if (!business_id) {
      return new Response("<h1>Missing business_id parameter</h1>", {
        status: 400,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);
    const { company_name, brand_color, my_name } = settings;

    const resolvedColor = brand_color || "#16a34a";

    // Escape values for safe embedding in JS string literals inside the HTML
    const safeJs = (s: string) =>
      (s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");

    // Escape values for safe embedding in HTML attributes / content
    const safeHtml = (s: string) =>
      (s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const followupEndpoint =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/one-year-followup-entry`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Job Complete &mdash; ${safeHtml(company_name)}</title>
  <style>
    :root { --brand: ${resolvedColor}; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #111;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 16px 56px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f1f5f9;
    }

    /* ── VF Badge ── */
    .vf-badge {
      width: 52px;
      height: 52px;
      background: var(--brand);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -1px;
      margin-bottom: 20px;
      flex-shrink: 0;
    }

    /* ── Card ── */
    .card {
      background: #1a1a1a;
      border-radius: 18px;
      border: 1px solid var(--brand);
      box-shadow: 0 0 36px color-mix(in srgb, var(--brand) 22%, transparent);
      padding: 28px 22px;
      width: 100%;
      max-width: 480px;
    }

    h1 {
      font-size: 21px;
      font-weight: 700;
      color: #f8fafc;
      text-align: center;
      margin-bottom: 22px;
    }

    /* ── Info box ── */
    .info-box {
      background: #111;
      border-left: 3px solid var(--brand);
      border-radius: 8px;
      padding: 16px 16px 16px 18px;
      margin-bottom: 26px;
      font-size: 13px;
      line-height: 1.75;
      color: #94a3b8;
    }

    .info-box p { margin-bottom: 6px; }
    .info-box p:last-child { margin-bottom: 0; }
    .info-box .step { color: #cbd5e1; font-weight: 600; }
    .info-box .note { color: #64748b; font-style: italic; }
    .info-box .arrow { text-align: center; font-size: 18px; margin: 2px 0; }
    .info-box .cta { color: #f1f5f9; font-weight: 600; margin-top: 4px; }

    /* ── Form fields ── */
    .field { margin-bottom: 18px; }

    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 7px;
    }

    input {
      width: 100%;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 13px 14px;
      font-size: 16px;
      color: #f1f5f9;
      outline: none;
      transition: border-color .15s;
      -webkit-appearance: none;
    }

    input:focus { border-color: var(--brand); }
    input::placeholder { color: #3f3f3f; }

    input.invalid { border-color: #f87171; }

    .field-error {
      display: none;
      color: #f87171;
      font-size: 12px;
      margin-top: 6px;
    }
    .field-error.visible { display: block; }

    /* ── Submit ── */
    #submit-btn {
      width: 100%;
      background: var(--brand);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
      margin-top: 6px;
      transition: filter .15s;
      letter-spacing: .01em;
    }

    #submit-btn:hover:not(:disabled) { filter: brightness(1.1); }
    #submit-btn:disabled { opacity: .55; cursor: default; }

    /* ── Form-level error ── */
    #form-error {
      display: none;
      color: #f87171;
      font-size: 13px;
      text-align: center;
      margin-top: 14px;
    }

    /* ── Success ── */
    #success {
      display: none;
      text-align: center;
      padding: 20px 0 8px;
      font-size: 16px;
      line-height: 1.7;
      color: #86efac;
    }

    /* ── Footer ── */
    footer {
      margin-top: 28px;
      font-size: 12px;
      color: #2d2d2d;
    }
  </style>
</head>
<body>

  <div class="vf-badge">VF</div>

  <div class="card">
    <h1>${safeHtml(company_name)}</h1>

    <div class="info-box">
      <p class="step">1. &#11088; This will send out your 5 star review request funnel (gatekeeping negative reviews)</p>
      <p>&#8212; Customer will be reminded to leave you a 5&#9733; review 4 times over a 4 week period</p>
      <p class="note">(*automation stops if they leave a review*)</p>
      <p class="arrow">&#128071;</p>
      <p class="step">2. &#128197; Customer will be put into your 1 year follow up sequence</p>
      <p>&#8212; Customer will be texted every 2&#8211;3 months reminding them of your return customer discount + requesting referrals for the same discount</p>
      <p class="cta">Fill in the information below &#128071;&#128071;&#128071;</p>
    </div>

    <form id="jcf" novalidate>
      <div class="field">
        <label for="first-name">Customer First Name</label>
        <input
          id="first-name"
          type="text"
          placeholder="Customer's first name (For example: John)"
          autocomplete="given-name"
          required
        />
        <div class="field-error" id="name-err">Please enter the customer&rsquo;s first name.</div>
      </div>

      <div class="field">
        <label for="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          placeholder="Phone (For example: 8085551234)"
          autocomplete="tel"
          inputmode="tel"
          required
        />
        <div class="field-error" id="phone-err">Please enter a valid 10-digit phone number.</div>
      </div>

      <button type="submit" id="submit-btn">Submit!</button>
      <div id="form-error">Something went wrong. Please try again.</div>
    </form>

    <div id="success"></div>
  </div>

  <footer>Powered by VargaFlow</footer>

  <script>
    var BUSINESS_ID      = '${safeJs(business_id)}';
    var FOLLOWUP_ENDPOINT = '${safeJs(followupEndpoint)}';

    var form       = document.getElementById('jcf');
    var nameInput  = document.getElementById('first-name');
    var phoneInput = document.getElementById('phone');
    var nameErr    = document.getElementById('name-err');
    var phoneErr   = document.getElementById('phone-err');
    var submitBtn  = document.getElementById('submit-btn');
    var formError  = document.getElementById('form-error');
    var successBox = document.getElementById('success');

    function digitsOnly(v) { return v.replace(/\\D/g, ''); }

    function clearErrors() {
      nameInput.classList.remove('invalid');
      phoneInput.classList.remove('invalid');
      nameErr.classList.remove('visible');
      phoneErr.classList.remove('visible');
      formError.style.display = 'none';
    }

    function validate() {
      var ok = true;
      var name  = nameInput.value.trim();
      var phone = digitsOnly(phoneInput.value);

      if (!name) {
        nameInput.classList.add('invalid');
        nameErr.classList.add('visible');
        ok = false;
      }
      if (phone.length !== 10) {
        phoneInput.classList.add('invalid');
        phoneErr.classList.add('visible');
        ok = false;
      }
      return ok;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      if (!validate()) return;

      var firstName = nameInput.value.trim();
      var phone     = digitsOnly(phoneInput.value);

      submitBtn.disabled    = true;
      submitBtn.textContent = 'Submitting\\u2026';

      fetch(FOLLOWUP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id:         BUSINESS_ID,
          contact_first_name:  firstName,
          contact_phone:       phone
        })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Server error ' + res.status);
        form.style.display = 'none';
        successBox.style.display = 'block';
        successBox.innerHTML =
          '\\u2705 Done! <strong>' + firstName + '</strong> has been added to your review + ' +
          'follow-up sequence. They will receive a review request shortly.';
      })
      .catch(function () {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Submit!';
        formError.style.display = 'block';
      });
    });

    /* Clear field error on re-type */
    nameInput.addEventListener('input', function () {
      nameInput.classList.remove('invalid');
      nameErr.classList.remove('visible');
    });
    phoneInput.addEventListener('input', function () {
      phoneInput.classList.remove('invalid');
      phoneErr.classList.remove('visible');
    });
  </script>

</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (err) {
    console.error("[job-complete-form]", err);
    return new Response(
      `<h1 style="font-family:sans-serif;padding:2rem">Failed to load form: ${
        (err as Error).message
      }</h1>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
