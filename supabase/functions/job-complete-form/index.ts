/**
 * job-complete-form (retired)
 *
 * Used to serve a public HTML form that started the review-request + 1-year
 * follow-up sequence via one-year-followup-entry. That function now requires a
 * logged-in user of the business, so a public form can no longer start
 * sequences. Contractors add jobs from the app's Add Job page instead.
 *
 * Kept deployed so old bookmarked links explain where the form went rather
 * than 404. The original form is in git history.
 *
 * Auth: verify_jwt = false (public page)
 */

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form moved</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:24px;text-align:center">
  <div>
    <h1 style="font-size:20px;margin-bottom:8px">This form has moved</h1>
    <p style="color:#aaa">Log in to your app and use <strong>Add Job</strong> to start a customer's review and follow-up texts.</p>
  </div>
</body>
</html>`;

Deno.serve(() =>
  new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
);
