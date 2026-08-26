# Admin bulk email — design spec

## Purpose

Give the two operator accounts (`info@branhamsermons.ai`, `admin@branhamsermons.ai`)
a way to compose a message once and send it to every registered user who has
selected a given language — for announcements, outages, feature notices, etc.
Not a marketing/CRM tool: no scheduling, no templates library, no send
history UI. One compose form, one confirmation gate, one send.

## Access control

A single new module owns the allowlist:

```ts
// src/lib/email/adminAllowlist.ts
const ADMIN_EMAILS = ["info@branhamsermons.ai", "admin@branhamsermons.ai"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
```

Used in two independent places, neither trusting the other — the same
defense-in-depth pattern this codebase already applies to the conversation-
share RPCs (`CLAUDE.md`'s "Conversation sharing" section: the share RLS was
once broken by trusting one layer's gate, so every layer re-checks):

1. **Page gate** (`src/app/admin/send-email/page.tsx`, server component):
   `redirect("/login")` if unauthenticated, `redirect("/chat")` if
   authenticated but `!isAdminEmail(user.email)`.
2. **API gate** (`src/app/api/admin/send-email/route.ts`): re-derives the
   caller's session server-side and re-checks `isAdminEmail`, independent of
   whether the request came through the gated page.

**Profile page**: `ProfileContent` gets a new "Send bulk email" button,
rendered only when `isAdminEmail(user.email)` (computed server-side in
`profile/page.tsx` and passed down as a prop, same pattern as
`currentLanguage`), linking to `/admin/send-email`.

## Route & layout

New top-level route, not nested under the existing `(auth)` group — that
group's layout is a `max-w-sm` centered card, sized for login/signup forms,
too narrow for a compose form with a subject field and a large textarea.
`src/app/admin/send-email/page.tsx` renders its own wider container and
mounts a new client component, `SendEmailForm`
(`src/components/admin/SendEmailForm.tsx`).

## Compose + confirm UX

`SendEmailForm` fields:
- **Language** select (English / Español / Français) — determines both the
  recipient filter and which greeting template is used.
- **Subject** text input.
- **Body** textarea (plain text / light markdown, same convention
  `sendEmail.ts` already uses for the welcome email).

Flow:
1. "Continue" → calls `POST /api/admin/send-email` with
   `{ language, confirm: false }` (a dry run — no subject/body needed yet)
   to resolve today's recipient count for that language.
2. A confirmation modal opens showing "You're about to email **N** users in
   **{language}**" plus a read-only preview of the subject/body as composed.
   A checkbox — "I've read this email and confirm it's ready to send" — gates
   the modal's Send button (disabled until checked).
3. Confirming calls `POST /api/admin/send-email` again with
   `{ language, subject, bodyMarkdown, confirm: true }`. Recipients are
   resolved **fresh** on this call (not reused from the dry run) — the two
   calls are independent, so a user who signs up or changes their language
   between preview and send is handled correctly rather than off a stale
   list.
4. On response, the modal replaces its content with a summary: "N sent, M
   failed" (see Error handling below for what "failed" means here).

## Personalization

Applied server-side, per recipient, immediately before sending — never
client-side, so the admin never has to think about it:

1. **Strip a hand-typed greeting, if present.** If the body's first
   non-blank line matches a greeting pattern for the *selected* language —
   starts with a known greeting word and ends in a comma — that line (and
   one following blank line, if any) is removed before the code-generated
   greeting is added. Patterns:
   - en: `/^(dear|hi|hello|hey)\b.*,\s*$/i`
   - es: `/^(hola|estimado|estimada|querido|querida)\b.*,\s*$/i`
   - fr: `/^(bonjour|cher|ch[eè]re|salut)\b.*,\s*$/i`
2. **Prepend the code-generated greeting**, using `profiles.display_name`
   when the recipient has one:
   - en: `Dear {name},`
   - es: `Hola {name},`
   - fr: `Bonjour {name},`
3. **Fallback when `display_name` is null** — true for every Email-OTP
   signup (confirmed via `supabase/migrations/001_initial_schema.sql`: the
   `handle_new_user()` trigger only populates `display_name` from
   `raw_user_meta_data ->> 'full_name'`/`'name'`, which only Google OAuth
   provides). Falls back to a plain, nameless greeting: `Hello,` / `Hola,` /
   `Bonjour,`.

Confirmed (per your question): `profiles.language` is a real, queried column
(`not null default 'en'`, set at signup, updatable from the profile page's
`updateUserLanguage`) — so filtering recipients by it is filtering on live,
accurate data, not a guess.

## Recipient resolution

`profiles.language` tells us who wants which language, but `profiles` has no
email column — email only lives on `auth.users`, which RLS-scoped clients
can't read across users. Resolving a recipient list needs the Supabase Admin
API, which requires a service-role client:

- **New `src/lib/supabase/admin.ts`**: a shared service-role client factory
  (`persistSession: false`, `autoRefreshToken: false`), extracted because
  this is now the second call site needing one — `tryClaimAlert.ts`
  constructs an equivalent client inline today. (Not refactoring
  `tryClaimAlert.ts` to use the new shared helper — unrelated file, out of
  scope for this feature.)
- Paginate `supabase.auth.admin.listUsers({ page, perPage: 1000 })` until an
  empty page, building a `user_id → email` map.
- Query `profiles` filtered to the selected `language`, selecting
  `user_id, display_name`.
- Join in memory: for each matching profile, look up its email in the map;
  profiles with no matching auth user (shouldn't happen — `profiles.user_id`
  is FK'd to `auth.users(id) on delete cascade` — but skip defensively rather
  than crash if it ever does) are dropped from the recipient list.

## Sending

**New `sendBulkEmail()` in `src/lib/email/sendEmail.ts`** (keeps all Postmark
integration in one file):

- Chunks the resolved recipient list into batches of 500 (Postmark's
  `/email/batch` endpoint limit).
- Each batch is one POST to `https://api.postmarkapp.com/email/batch`, with
  one message object per recipient (**never** a shared `To` list — each
  recipient is a separate message, so recipients never see each other's
  addresses).
- Each message's `TextBody`/`HtmlBody` is built by running that recipient's
  personalized body through the same `markdownToEmailHtml()` helper the
  welcome email already uses.
- Batches are sent **sequentially** (not `Promise.all`) — Cloudflare Workers
  caps simultaneous in-flight connections waiting on response headers at 6
  per invocation; sequential batches sidestep that limit entirely and this
  isn't latency-sensitive (no user is waiting on a streamed response, unlike
  chat).
- Aggregates Postmark's per-message batch response (`ErrorCode`/`Message`
  per recipient) into `{ total, sent, failed }`; any failed sends are logged
  server-side (`console.error`, recipient email + Postmark error) for the
  admin to investigate manually — no retry, no send-history table (not asked
  for).

### On Cloudflare Workers limits — not a real constraint here

Verified against Cloudflare's current published limits: the Workers Paid
plan (confirmed — this project is on the $5/month tier) allows **10,000
subrequests per invocation** by default, and CPU time (30s default, up to 5
min configurable) does **not** count time spent waiting on `fetch()` calls —
only actual compute does, which this flow has very little of.

This design's subrequest cost per send is roughly
`ceil(totalUsers / 1000)` (listUsers pagination) +
`ceil(recipientsInLanguage / 500)` (Postmark batches) — worst case (every
user in one language) approximately `totalUsers × 0.003`. At the stated
long-term goal of 16,000 registered users, that's roughly **48
subrequests** — under 0.5% of the 10,000 budget. No pagination-limit design
work is needed for this feature at any scale this app is realistically
headed toward.

## Error handling

- **Postmark not configured** (`POSTMARK_SERVER_TOKEN` missing): `sendEmail`/
  `sendBulkEmail` already returns `{ ok: false, error: ... }` for this today
  — the route surfaces it as a top-level failure before attempting any
  sends, not a partial-failure count.
- **Partial batch failure**: a batch entry failing doesn't block the rest of
  that batch or subsequent batches; the failure is counted and logged, send
  continues.
- **Zero recipients for the selected language**: the dry-run response
  returns `{ recipientCount: 0 }`; the confirmation modal shows this
  plainly ("You're about to email 0 users") rather than silently disabling
  the flow — the admin decides whether that's expected.
- **Non-admin or unauthenticated hitting the API route directly**: `401`/
  `403`, no recipient resolution attempted (the allowlist check happens
  before any Supabase Admin API call).

## Out of scope (explicitly, not deferred-but-forgotten)

- No per-language content variants — one subject/body per send, one
  language's recipients per send. Reaching all three languages is three
  separate sends.
- No send-history/audit log table.
- No scheduling — sends immediately on confirm.
- No retry UI for failed recipients within a batch.

## Testing

No test runner in this repo (confirmed — no Jest/Vitest, no `*.test.ts`
files); verification is manual, per `CLAUDE.md`'s standing UI-testing
guidance:

- Non-admin account: confirm no "Send bulk email" button on `/profile`, and
  confirm `/admin/send-email` redirects to `/chat` if visited directly.
- Unauthenticated: confirm `/admin/send-email` redirects to `/login`.
- Admin account (either allowlisted email): confirm the button appears and
  the page loads.
- Dry run: confirm the recipient count matches the actual number of
  `profiles` rows with the selected language.
- A body that already starts with a hand-typed "Dear NAME," line for the
  selected language — confirm it's stripped and replaced by the
  code-generated greeting, not duplicated.
- A body with no hand-typed greeting — confirm the greeting is simply
  prepended.
- A recipient with a `display_name` vs. one with `display_name = null` —
  confirm the personalized vs. generic greeting respectively.
- Zero recipients for a language — confirm the modal shows "0 users" rather
  than erroring.
- A deliberately-broken `POSTMARK_SERVER_TOKEN` (temporarily, in `.dev.vars`)
  — confirm the top-level failure path, not a false "sent" summary.
