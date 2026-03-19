/**
 * chat-widget
 *
 * Serves a self-contained JavaScript widget that embeds a floating chat button
 * + lead capture form on any client website.
 *
 * Usage:
 *   <script src="https://<project>.supabase.co/functions/v1/chat-widget?business_id=YOUR_ID"></script>
 *
 * URL param: business_id
 * Returns:   application/javascript
 * Auth:      verify_jwt = false (public endpoint)
 *
 * Settings columns used: company_name, brand_color, logo_url
 * No auth keys are embedded in the returned JS — the widget only posts to the
 * public chat-widget-lead endpoint with non-sensitive fields.
 */

import { fetchSettings, getSupabaseAdmin } from "../_shared/helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const business_id = url.searchParams.get("business_id");

    if (!business_id) {
      return new Response(`console.error("[chat-widget] Missing business_id param");`, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/javascript" },
      });
    }

    const supabase = getSupabaseAdmin();
    const settings = await fetchSettings(supabase, business_id);
    const {
      company_name,
      brand_color,
      logo_url,
    } = settings;

    const leadEndpoint =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-widget-lead`;

    // Escape values for safe embedding in single-quoted JS string literals
    const safe = (s: string) =>
      (s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");

    const resolvedColor = brand_color || "#16a34a";

    const js = `
(function () {
  if (window.__chatWidgetLoaded) return;
  window.__chatWidgetLoaded = true;

  var BUSINESS_ID   = '${safe(business_id)}';
  var COMPANY_NAME  = '${safe(company_name)}';
  var BRAND_COLOR   = '${safe(resolvedColor)}';
  var LOGO_URL      = '${safe(logo_url ?? "")}';
  var LEAD_ENDPOINT = '${safe(leadEndpoint)}';

  /* ── CSS custom property for brand colour ───────────────────── */
  document.documentElement.style.setProperty('--cw-brand', BRAND_COLOR);

  /* ── Inject styles ───────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    /* --- Notification bubble --- */
    '#cw-bubble{position:fixed;bottom:90px;right:24px;z-index:99998;background:#fff;',
    'border-radius:12px;padding:12px 34px 12px 14px;max-width:230px;',
    'box-shadow:0 4px 18px rgba(0,0,0,.14);font-size:13px;line-height:1.5;',
    'font-family:sans-serif;color:#1e293b;transition:opacity .2s;}',

    '#cw-bubble.cw-hidden{opacity:0;pointer-events:none;}',

    /* triangle pointing down toward button */
    '#cw-bubble::after{content:"";position:absolute;bottom:-8px;right:20px;',
    'border-left:8px solid transparent;border-right:8px solid transparent;',
    'border-top:8px solid #fff;}',

    '#cw-bubble-close{position:absolute;top:7px;right:8px;background:none;border:none;',
    'cursor:pointer;font-size:14px;color:#94a3b8;line-height:1;padding:0;}',
    '#cw-bubble-close:hover{color:#475569;}',

    /* --- Floating button --- */
    '#cw-btn{position:fixed;bottom:24px;right:24px;z-index:99998;',
    'width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;',
    'background:var(--cw-brand);display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 4px 16px rgba(0,0,0,.28);transition:transform .15s;}',
    '#cw-btn:hover{transform:scale(1.08);}',

    /* --- Overlay --- */
    '#cw-overlay{display:none;position:fixed;inset:0;z-index:99999;',
    'background:rgba(0,0,0,.45);align-items:flex-end;justify-content:center;}',
    '#cw-overlay.cw-open{display:flex;}',

    /* --- Popup box --- */
    '#cw-box{background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:440px;',
    'font-family:sans-serif;overflow:hidden;box-shadow:0 -4px 30px rgba(0,0,0,.2);',
    'display:flex;flex-direction:column;}',

    /* --- Header --- */
    '#cw-header{display:flex;align-items:center;justify-content:space-between;',
    'padding:14px 16px;background:var(--cw-brand);}',
    '#cw-header-content{display:flex;align-items:center;gap:10px;min-width:0;}',
    '#cw-header-content img{max-height:40px;width:auto;object-fit:contain;flex-shrink:0;}',
    '#cw-header-content span{color:#fff;font-size:16px;font-weight:600;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#cw-close{background:none;border:none;color:rgba(255,255,255,.8);',
    'font-size:22px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;margin-left:10px;}',
    '#cw-close:hover{color:#fff;}',

    /* --- Subheader --- */
    '#cw-subheader{background:#f1f5f9;padding:10px 16px;font-size:12px;',
    'color:#64748b;line-height:1.5;}',

    /* --- Body --- */
    '#cw-body{padding:16px;overflow-y:auto;}',

    /* --- Fields --- */
    '.cw-field{display:flex;flex-direction:column;margin-bottom:12px;}',
    '.cw-field label{font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;}',
    '.cw-field input,.cw-field textarea{border:1px solid #d1d5db;border-radius:8px;',
    'padding:9px 12px;font-size:14px;font-family:sans-serif;outline:none;',
    'transition:border-color .15s;color:#1e293b;}',
    '.cw-field input:focus,.cw-field textarea:focus{border-color:var(--cw-brand);}',
    '.cw-field textarea{resize:vertical;min-height:72px;}',

    /* --- Consent --- */
    '#cw-consent{display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;}',
    '#cw-consent input[type=checkbox]{margin-top:3px;flex-shrink:0;',
    'accent-color:var(--cw-brand);}',
    '#cw-consent label{font-size:11px;color:#6b7280;line-height:1.5;cursor:pointer;}',

    /* --- Submit --- */
    '#cw-submit{width:100%;background:var(--cw-brand);color:#fff;border:none;',
    'border-radius:8px;padding:12px;font-size:15px;font-weight:600;',
    'cursor:pointer;font-family:sans-serif;letter-spacing:.01em;}',
    '#cw-submit:hover:not(:disabled){filter:brightness(1.08);}',
    '#cw-submit:disabled{opacity:.6;cursor:default;}',

    /* --- Confirmation --- */
    '#cw-confirm{display:none;padding:28px 16px;text-align:center;',
    'font-size:15px;color:#1e293b;line-height:1.6;}',

    /* --- Footer --- */
    '#cw-footer{text-align:center;padding:10px;font-size:11px;color:#94a3b8;',
    'font-family:sans-serif;border-top:1px solid #f1f5f9;}',

    /* --- Responsive --- */
    '@media(min-width:480px){',
    '#cw-overlay{align-items:center;padding:16px;}',
    '#cw-box{border-radius:16px;}',
    '}'
  ].join('');
  document.head.appendChild(style);

  /* ── Notification bubble ─────────────────────────────────────── */
  var bubble = document.createElement('div');
  bubble.id = 'cw-bubble';
  bubble.innerHTML =
    'Shoot me any questions and I will get back to you with all the answers! (I promise) \ud83d\udcac' +
    '<button id="cw-bubble-close" aria-label="Dismiss">\u2715</button>';
  document.body.appendChild(bubble);

  function hideBubble() {
    bubble.classList.add('cw-hidden');
  }

  document.getElementById('cw-bubble-close').addEventListener('click', function (e) {
    e.stopPropagation();
    hideBubble();
  });

  /* ── Floating button ─────────────────────────────────────────── */
  var btn = document.createElement('button');
  btn.id = 'cw-btn';
  btn.setAttribute('aria-label', 'Open chat');
  /* chat bubble SVG icon */
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white">' +
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>' +
    '</svg>';
  document.body.appendChild(btn);

  /* ── Chat popup ──────────────────────────────────────────────── */
  var logoHtml = LOGO_URL
    ? '<img src="' + LOGO_URL + '" alt="' + COMPANY_NAME + ' logo" />'
    : '';

  var overlay = document.createElement('div');
  overlay.id = 'cw-overlay';
  overlay.innerHTML = [
    '<div id="cw-box">',
    '  <div id="cw-header">',
    '    <div id="cw-header-content">',
    '      ' + logoHtml,
    '      <span>' + COMPANY_NAME + '</span>',
    '    </div>',
    '    <button id="cw-close" aria-label="Close">\u2715</button>',
    '  </div>',
    '  <div id="cw-subheader">',
    '    This text goes straight to my personal phone. I will make sure to get back to you the second I\\'m free!',
    '  </div>',
    '  <div id="cw-body">',
    '    <form id="cw-form">',
    '      <div class="cw-field">',
    '        <label for="cw-name">Name</label>',
    '        <input id="cw-name" type="text" placeholder="Jane Smith" required />',
    '      </div>',
    '      <div class="cw-field">',
    '        <label for="cw-phone">Phone</label>',
    '        <input id="cw-phone" type="tel" placeholder="+1 (555) 000-0000" required />',
    '      </div>',
    '      <div class="cw-field">',
    '        <label for="cw-msg">Message</label>',
    '        <textarea id="cw-msg" placeholder="I want to know more" required></textarea>',
    '      </div>',
    '      <div id="cw-consent">',
    '        <input type="checkbox" id="cw-consent-check" required />',
    '        <label for="cw-consent-check">By submitting you agree to receive SMS or e-mails on the provided channel. Rates may be applied.</label>',
    '      </div>',
    '      <button id="cw-submit" type="submit">Send :) \u27a4</button>',
    '    </form>',
    '    <div id="cw-confirm"></div>',
    '  </div>',
    '  <div id="cw-footer">Powered by VargaFlow</div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);

  /* ── Open / close ────────────────────────────────────────────── */
  function openWidget() {
    hideBubble();
    overlay.classList.add('cw-open');
  }
  function closeWidget() { overlay.classList.remove('cw-open'); }

  btn.addEventListener('click', openWidget);
  document.getElementById('cw-close').addEventListener('click', closeWidget);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeWidget();
  });

  /* ── Form submit ─────────────────────────────────────────────── */
  document.getElementById('cw-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var name      = document.getElementById('cw-name').value.trim();
    var phone     = document.getElementById('cw-phone').value.trim();
    var msg       = document.getElementById('cw-msg').value.trim();
    var submitBtn = document.getElementById('cw-submit');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending\u2026';

    fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id:   BUSINESS_ID,
        contact_name:  name,
        contact_phone: phone,
        message:       msg
      })
    })
    .then(function () {
      document.getElementById('cw-form').style.display = 'none';
      var confirm = document.getElementById('cw-confirm');
      confirm.style.display = 'block';
      confirm.textContent = 'Thanks ' + name + '! We got your message and will be in touch very soon. \ud83d\ude4c';
    })
    .catch(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send :) \u27a4';
      alert('Something went wrong. Please try again.');
    });
  });
})();
`.trim();

    return new Response(js, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[chat-widget]", err);
    const msg = (err as Error).message;
    return new Response(
      `console.error("[chat-widget] Failed to load widget: ${msg.replace(/'/g, "\\'")}");`,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/javascript" },
      },
    );
  }
});
