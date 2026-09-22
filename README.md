# VargaFlow Client

The contractor-facing app. Where a VargaFlow client (a roofing, plumbing, HVAC or electrical business) manages their own customers: contacts, two-way messaging, browser calling, and the post-job automations that turn finished work into reviews and repeat business.

Separate from the admin CRM by design. The admin app's automations fire at *prospects of VargaFlow*; this app's automations fire at *the contractor's own customers*, which means different copy, different voice, a different table of sequence templates, and its own set of edge functions.

## What it does

- **Contacts and jobs** — the contractor's customer list, with job history
- **Two-way messaging** — SMS conversations, inbound and outbound
- **Browser calling** — call customers from the app, scoped per business, with call logging
- **Post-job automations**:
  - review funnel, triggered when a job is marked complete
  - one-year referral follow-up
  - database reactivation for dormant customers
  - missed-call text-back, so a missed call turns into a conversation instead of a lost job

## Architecture

```
job marked complete  ──►  edge function  ──►  message_queue  ──►  Twilio / Resend
missed inbound call  ──►  inbound-call   ──►  text-back
```

Multi-tenant: every query, every queued message and every voice token is scoped by `business_id`, enforced with row-level security rather than application-layer filtering.

**Frontend** — React 18, TypeScript, Vite, Tailwind, shadcn/ui, Vitest.

**Backend** — Supabase Postgres plus this app's own Deno edge functions under `supabase/functions/`. Contractor-side sequence copy lives in its own `client_sequence_templates` table, kept separate from the VargaFlow-side sequences so the two voices never bleed into each other.

## Problems worth reading the code for

- **Per-tenant voice** — issuing Twilio access tokens scoped to a `business_id` so one contractor can never dial from another's number, with EU edge configuration for latency.
- **Missed-call text-back** — the race between a call ending, the webhook arriving and the customer calling back is narrower than it looks.
- **Multi-tenant RLS** — getting policies right so a contractor sees exactly their own data, with no service-role escape hatch in the client path.

## Running it

```bash
npm install
cp .env.example .env
npm run dev             # port 8080
npm run test
npm run build
```

Edge functions in this repo deploy from this repo:

```bash
supabase functions deploy <name> --project-ref <ref>
```

Both apps share one Supabase project, so check which app owns a function before adding or deploying one.
