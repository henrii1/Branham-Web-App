# Admin Bulk Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the two operator accounts (`info@branhamsermons.ai`, `admin@branhamsermons.ai`) compose one message from their profile page and send it, with a confirmation gate, to every registered user whose saved language preference matches a selected language — with a personalized greeting line generated per recipient.

**Architecture:** A hardcoded email allowlist (`isAdminEmail`) gates both the page and the API route independently. The API route resolves recipients via a service-role Supabase client (`auth.admin.listUsers()` joined against `profiles.language`/`display_name` — `profiles` has no email column, so this is the only way to get one), applies a per-recipient greeting via a pure `greeting.ts` module, and sends via a new Postmark batch-endpoint wrapper (`sendBulkEmail`, chunked at 500 recipients/call, one message per recipient — never a shared `To` list). One route handles both a dry-run recipient count (for the confirmation modal) and the real send.

**Tech Stack:** Plain TypeScript/React + existing Postmark integration, no new dependencies. No test runner exists in this repo (confirmed: no jest/vitest in `package.json`, no `*.test.ts` files) — `tsx` is already a devDependency, so all pure-logic tasks (1, 2, 4, 5) are verified with throwaway `tsx`-run assertion scripts (deleted once they pass, never committed, including a mocked `fetch` for the Postmark batching logic and a fake Supabase client for the recipient-resolution pagination/join logic); UI and route-wiring tasks are verified manually via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-08-26-admin-bulk-email-design.md`

## Global Constraints

- Admin allowlist is exactly two hardcoded, case-insensitive emails: `info@branhamsermons.ai`, `admin@branhamsermons.ai` (spec §Access control). Never sourced from an env var or DB flag.
- Both the page (`/admin/send-email`) and the API route (`/api/admin/send-email`) independently re-check the allowlist — neither trusts the other (spec §Access control, defense-in-depth).
- Recipients = every row in `auth.users` whose linked `profiles.language` matches the selected language, **including** the two admin accounts themselves if their language matches (spec §Recipient resolution — confirmed during brainstorming: no exclusion).
- One send = one language. Reaching all three languages requires three separate sends — no per-language content variants in a single send (spec §Out of scope).
- Every recipient gets their own individual Postmark message — **never** a shared `To` list (privacy: recipients must never see each other's addresses).
- Greeting personalization is **always server-side**, never client-editable: strip a hand-typed leading salutation matching the *selected send language* only, then prepend the code-generated greeting. Missing `display_name` (every Email-OTP signup) falls back to a plain nameless greeting, never a guessed name from the email address (spec §Personalization).
- Postmark batch size: 500 messages per call (Postmark's own limit), batches sent **sequentially**, not `Promise.all` (spec §Sending — Cloudflare Workers caps 6 simultaneous in-flight connections waiting on response headers per invocation).
- No send-history/audit table, no scheduling, no retry UI for individual failed recipients within a batch (spec §Out of scope — not being added speculatively).
- Cloudflare Workers subrequest limits are confirmed **not a real constraint** at this app's scale (10,000/invocation on the $5/month Paid plan this project runs on; ~48 subrequests worst-case at the stated 16,000-user long-term goal) — no special pagination-limit handling is needed in this plan.

---

## Task 1: Admin email allowlist

**Files:**
- Create: `src/lib/email/adminAllowlist.ts`
- Verify: `src/lib/email/__verify_adminAllowlist.ts` (throwaway, delete before committing)

**Interfaces:**
- Produces: `export function isAdminEmail(email: string | null | undefined): boolean` — consumed by Task 6 (API route) and Task 8 (page gate + profile button).

- [ ] **Step 1: Write the throwaway verification script first**

Create `src/lib/email/__verify_adminAllowlist.ts`:

```ts
import assert from "node:assert/strict";
import { isAdminEmail } from "./adminAllowlist";

assert.equal(isAdminEmail("info@branhamsermons.ai"), true);
assert.equal(isAdminEmail("admin@branhamsermons.ai"), true);
assert.equal(isAdminEmail("ADMIN@BRANHAMSERMONS.AI"), true, "must be case-insensitive");
assert.equal(isAdminEmail("someone@example.com"), false);
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(undefined), false);
assert.equal(isAdminEmail(""), false);

console.log("adminAllowlist.ts verification: OK");
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/lib/email/__verify_adminAllowlist.ts`
Expected: module-not-found / no-export compile error — `adminAllowlist.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/email/adminAllowlist.ts`:

```ts
const ADMIN_EMAILS = ["info@branhamsermons.ai", "admin@branhamsermons.ai"];

/**
 * True if `email` (case-insensitive) is one of the two hardcoded operator
 * accounts allowed to use the bulk-email tool. Never sourced from an env
 * var or DB flag — see the design spec's Access control section.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
```

- [ ] **Step 4: Run it again and confirm it passes**

Run: `npx tsx src/lib/email/__verify_adminAllowlist.ts`
Expected: prints `adminAllowlist.ts verification: OK`.

- [ ] **Step 5: Delete the throwaway script and lint**

```bash
rm src/lib/email/__verify_adminAllowlist.ts
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/adminAllowlist.ts
git commit -m "feat: add hardcoded admin email allowlist"
```

---

## Task 2: Personalized greeting logic

**Files:**
- Create: `src/lib/email/greeting.ts`
- Verify: `src/lib/email/__verify_greeting.ts` (throwaway, delete before committing)

**Interfaces:**
- Produces: `export type EmailLanguage = "en" | "es" | "fr"`, `export function buildGreeting(language: EmailLanguage, displayName: string | null): string`, `export function applyGreeting(bodyMarkdown: string, language: EmailLanguage, displayName: string | null): string` — consumed by Task 5 (`recipients.ts`'s type) and Task 6 (API route, which calls `applyGreeting`).

- [ ] **Step 1: Write the throwaway verification script first**

Create `src/lib/email/__verify_greeting.ts`:

```ts
import assert from "node:assert/strict";
import { buildGreeting, applyGreeting } from "./greeting";

assert.equal(buildGreeting("en", "Maria"), "Dear Maria,");
assert.equal(buildGreeting("en", null), "Hello,");
assert.equal(buildGreeting("es", "Maria"), "Hola Maria,");
assert.equal(buildGreeting("es", null), "Hola,");
assert.equal(buildGreeting("fr", "Jean"), "Bonjour Jean,");
assert.equal(buildGreeting("fr", null), "Bonjour,");
assert.equal(buildGreeting("en", "  "), "Hello,", "blank-only display_name treated as missing");

// A hand-typed greeting in the SELECTED language is stripped and replaced,
// never duplicated.
const withHandTyped = applyGreeting("Dear Team,\n\nWe have an update for you.", "en", "Maria");
assert.equal(withHandTyped, "Dear Maria,\n\nWe have an update for you.");
assert.equal((withHandTyped.match(/Dear/g) || []).length, 1, "greeting must not duplicate");

// No hand-typed greeting -> the code greeting is simply prepended.
const noHandTyped = applyGreeting("We have an update for you.", "en", null);
assert.equal(noHandTyped, "Hello,\n\nWe have an update for you.");

// A greeting-shaped line in a DIFFERENT language than the selected send
// language is NOT recognized/stripped -- it's just body text to us.
const wrongLangGreeting = applyGreeting("Bonjour Team,\n\nUpdate.", "en", "Maria");
assert.equal(wrongLangGreeting, "Dear Maria,\n\nBonjour Team,\n\nUpdate.");

// Spanish and French strip patterns also work.
assert.equal(
  applyGreeting("Hola equipo,\n\nActualización.", "es", "Carlos"),
  "Hola Carlos,\n\nActualización.",
);
assert.equal(
  applyGreeting("Cher client,\n\nMise à jour.", "fr", null),
  "Bonjour,\n\nCher client,\n\nMise à jour.",
  "fr strip pattern matches Bonjour/Cher/Chère/Salut, not \"Cher\" alone followed by non-comma text -- wait this IS \"Cher client,\" which DOES match, so it SHOULD be stripped",
);

console.log("greeting.ts verification: OK");
```

**Correction note for the step above:** the last assertion's expected value is wrong as written — "Cher client," in French *does* match the fr strip pattern (`/^(bonjour|cher|ch[eè]re|salut)\b.*,\s*$/i`), so it must be stripped, not kept. Write that assertion as:

```ts
assert.equal(
  applyGreeting("Cher client,\n\nMise à jour.", "fr", null),
  "Bonjour,\n\nMise à jour.",
);
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/lib/email/__verify_greeting.ts`
Expected: module-not-found — `greeting.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/email/greeting.ts`:

```ts
export type EmailLanguage = "en" | "es" | "fr";

// Matches a hand-typed leading salutation line in the target send language,
// so it can be stripped before the code-generated greeting is prepended
// (never duplicated). Only the first non-blank line of the body is ever
// checked against this.
const GREETING_STRIP_PATTERNS: Record<EmailLanguage, RegExp> = {
  en: /^(dear|hi|hello|hey)\b.*,\s*$/i,
  es: /^(hola|estimado|estimada|querido|querida)\b.*,\s*$/i,
  fr: /^(bonjour|cher|ch[eè]re|salut)\b.*,\s*$/i,
};

const NAMED_GREETING: Record<EmailLanguage, (name: string) => string> = {
  en: (name) => `Dear ${name},`,
  es: (name) => `Hola ${name},`,
  fr: (name) => `Bonjour ${name},`,
};

const GENERIC_GREETING: Record<EmailLanguage, string> = {
  en: "Hello,",
  es: "Hola,",
  fr: "Bonjour,",
};

/**
 * The greeting line for one recipient: named if `displayName` is present
 * and non-blank, a plain nameless greeting otherwise (every Email-OTP
 * signup has a null display_name — only Google OAuth populates it).
 */
export function buildGreeting(language: EmailLanguage, displayName: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? NAMED_GREETING[language](trimmed) : GENERIC_GREETING[language];
}

/**
 * Strips a hand-typed leading salutation line in `language` (if present)
 * and prepends the code-generated greeting for this recipient. Only the
 * first non-blank line is ever inspected.
 */
export function applyGreeting(
  bodyMarkdown: string,
  language: EmailLanguage,
  displayName: string | null,
): string {
  const lines = bodyMarkdown.split("\n");
  let firstContentIdx = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIdx === -1) firstContentIdx = 0;

  const isHandTypedGreeting = GREETING_STRIP_PATTERNS[language].test(
    lines[firstContentIdx]?.trim() ?? "",
  );
  const remainingLines = isHandTypedGreeting ? lines.slice(firstContentIdx + 1) : lines;

  const rest = remainingLines.join("\n").replace(/^\n+/, "");
  const greeting = buildGreeting(language, displayName);
  return rest ? `${greeting}\n\n${rest}` : greeting;
}
```

- [ ] **Step 4: Run it again and confirm it passes**

Run: `npx tsx src/lib/email/__verify_greeting.ts`
Expected: prints `greeting.ts verification: OK`.

- [ ] **Step 5: Delete the throwaway script and lint**

```bash
rm src/lib/email/__verify_greeting.ts
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/greeting.ts
git commit -m "feat: add per-recipient email greeting personalization"
```

---

## Task 3: Service-role Supabase admin client

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Verify: `src/lib/supabase/__verify_admin.ts` (throwaway, delete before committing)

**Interfaces:**
- Produces: `export function createAdminClient(): SupabaseClient` — consumed by Task 6 (API route). Requires `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` at call time (both already-configured secrets/vars per `CLAUDE.md`'s Environment variables table — no new secret to provision).

This mirrors the service-role client `src/lib/alerts/tryClaimAlert.ts` already constructs inline — extracted into a shared factory since this is now a second call site. `tryClaimAlert.ts` itself is **not** refactored to use it (unrelated file, out of scope for this feature).

- [ ] **Step 1: Write the throwaway verification script first**

Create `src/lib/supabase/__verify_admin.ts`:

```ts
import assert from "node:assert/strict";
import { createAdminClient } from "./admin";

// Without real Supabase credentials we can't verify a successful client
// build here, but we CAN verify the guard clause that prevents a silent
// half-configured client from being used.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.throws(() => createAdminClient(), /missing/i);

console.log("supabase/admin.ts verification: OK (guard clause only -- full client construction is verified against real credentials in Task 6's manual QA)");
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/lib/supabase/__verify_admin.ts`
Expected: module-not-found — `admin.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only admin operations (e.g.
 * auth.admin.listUsers()) that a session-scoped/RLS client cannot perform.
 * NEVER import this into client code -- SUPABASE_SERVICE_ROLE_KEY must
 * never reach the browser bundle.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

- [ ] **Step 4: Run it again and confirm it passes**

Run: `npx tsx src/lib/supabase/__verify_admin.ts`

- [ ] **Step 5: Delete the throwaway script, lint, and type-check**

```bash
rm src/lib/supabase/__verify_admin.ts
npm run lint
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "feat: add shared service-role Supabase admin client factory"
```

---

## Task 4: Batched Postmark sending

**Files:**
- Modify: `src/lib/email/sendEmail.ts`
- Verify: `src/lib/email/__verify_sendBulkEmail.ts` (throwaway, delete before committing)

**Interfaces:**
- Produces: `export interface BulkEmailMessage { to: string; subject: string; bodyMarkdown: string }`, `export interface BulkSendResult { total: number; sent: number; failed: number; failures: Array<{ to: string; error: string }> }`, `export async function sendBulkEmail(messages: BulkEmailMessage[], from?: string): Promise<BulkSendResult>` — consumed by Task 6 (API route).

- [ ] **Step 1: Write the throwaway verification script first**

Create `src/lib/email/__verify_sendBulkEmail.ts`:

```ts
import assert from "node:assert/strict";

process.env.POSTMARK_SERVER_TOKEN = "test-token";
process.env.POSTMARK_FROM_EMAIL = "info@branhamsermons.ai";

const { sendBulkEmail } = await import("./sendEmail");

let callCount = 0;
const originalFetch = globalThis.fetch;
// @ts-expect-error -- test override, narrower signature than the real fetch
globalThis.fetch = async (_url: string, init: { body: string }) => {
  callCount += 1;
  const sentMessages = JSON.parse(init.body) as Array<{ To: string }>;
  // Simulate exactly one failure: the second message of the FIRST batch.
  const results = sentMessages.map((_msg, i) => ({
    ErrorCode: callCount === 1 && i === 1 ? 300 : 0,
    Message: callCount === 1 && i === 1 ? "Invalid email address" : "OK",
    MessageID: "fake-id",
  }));
  return new Response(JSON.stringify(results), { status: 200 });
};

// 1200 recipients -> 3 batches of 500 / 500 / 200.
const messages = Array.from({ length: 1200 }, (_, i) => ({
  to: `user${i}@example.com`,
  subject: "Test",
  bodyMarkdown: "Body",
}));

const result = await sendBulkEmail(messages);

assert.equal(callCount, 3, "expected 3 batched Postmark calls for 1200 recipients");
assert.equal(result.total, 1200);
assert.equal(result.failed, 1, "expected exactly the one simulated failure");
assert.equal(result.sent, 1199);
assert.equal(result.failures.length, 1);
assert.equal(result.failures[0].to, "user1@example.com");

globalThis.fetch = originalFetch;
console.log("sendEmail.ts sendBulkEmail verification: OK");
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/lib/email/__verify_sendBulkEmail.ts`
Expected: `sendBulkEmail` is not exported yet.

- [ ] **Step 3: Implement**

Add to `src/lib/email/sendEmail.ts`, after the existing `sendEmail` function (keep the existing `POSTMARK_EMAIL_ENDPOINT`, `DEFAULT_FROM_EMAIL`, `escapeHtml`, `markdownToEmailHtml`, `PostmarkResponse`, and `sendEmail` exactly as they are today):

```ts
const POSTMARK_BATCH_ENDPOINT = "https://api.postmarkapp.com/email/batch";
const BULK_BATCH_SIZE = 500;

export interface BulkEmailMessage {
  to: string;
  subject: string;
  bodyMarkdown: string;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  failures: Array<{ to: string; error: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sends a personalized message to each recipient individually via
 * Postmark's batch endpoint (never a shared To list), chunked to its
 * 500-message-per-call limit. Batches run SEQUENTIALLY -- not Promise.all --
 * since Cloudflare Workers caps simultaneous in-flight connections waiting
 * on response headers at 6 per invocation, and this isn't latency-sensitive
 * (no user is waiting on a streamed response, unlike chat).
 */
export async function sendBulkEmail(
  messages: BulkEmailMessage[],
  from: string = process.env.POSTMARK_FROM_EMAIL || DEFAULT_FROM_EMAIL,
): Promise<BulkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const result: BulkSendResult = {
    total: messages.length,
    sent: 0,
    failed: 0,
    failures: [],
  };

  if (!token) {
    result.failed = messages.length;
    result.failures = messages.map((m) => ({
      to: m.to,
      error: "POSTMARK_SERVER_TOKEN is not configured.",
    }));
    return result;
  }

  for (const batch of chunk(messages, BULK_BATCH_SIZE)) {
    const response = await fetch(POSTMARK_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify(
        batch.map((m) => ({
          From: from,
          To: m.to,
          Subject: m.subject,
          TextBody: m.bodyMarkdown,
          HtmlBody: markdownToEmailHtml(m.bodyMarkdown),
          MessageStream: "outbound",
        })),
      ),
    });

    const payload = (await response.json().catch(() => null)) as PostmarkResponse[] | null;

    if (!response.ok || !payload) {
      for (const m of batch) {
        result.failed += 1;
        result.failures.push({
          to: m.to,
          error: `Postmark batch request failed with ${response.status}.`,
        });
      }
      continue;
    }

    payload.forEach((item, index) => {
      const recipient = batch[index];
      if (item.ErrorCode === 0) {
        result.sent += 1;
      } else {
        result.failed += 1;
        result.failures.push({ to: recipient?.to ?? "unknown", error: item.Message });
      }
    });
  }

  return result;
}
```

- [ ] **Step 4: Run it again and confirm it passes**

Run: `npx tsx src/lib/email/__verify_sendBulkEmail.ts`
Expected: prints `sendEmail.ts sendBulkEmail verification: OK`.

- [ ] **Step 5: Delete the throwaway script, lint, and type-check**

```bash
rm src/lib/email/__verify_sendBulkEmail.ts
npm run lint
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/sendEmail.ts
git commit -m "feat: add batched Postmark sending for bulk email"
```

---

## Task 5: Recipient resolution

**Files:**
- Create: `src/lib/email/recipients.ts`
- Verify: `src/lib/email/__verify_recipients.ts` (throwaway, delete before committing)

**Interfaces:**
- Consumes: `EmailLanguage` from `@/lib/email/greeting` (Task 2).
- Produces: `export interface EmailRecipient { email: string; displayName: string | null }`, `export async function resolveRecipients(admin: SupabaseClient, language: EmailLanguage): Promise<EmailRecipient[]>` — consumed by Task 6 (API route).

- [ ] **Step 1: Write the throwaway verification script first**

Create `src/lib/email/__verify_recipients.ts`:

```ts
import assert from "node:assert/strict";
import { resolveRecipients } from "./recipients";

// -- Scenario 1: join + language filter + display_name null-normalization --
const users = [
  { id: "u1", email: "a@example.com" },
  { id: "u2", email: "b@example.com" },
  { id: "u3", email: "c@example.com" },
];
const profiles = [
  { user_id: "u1", display_name: "Alice", language: "en" },
  { user_id: "u2", display_name: null, language: "en" },
  { user_id: "u3", display_name: "Carlos", language: "es" },
];

const smallFakeAdmin = {
  auth: {
    admin: {
      listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
        const start = (page - 1) * perPage;
        return { data: { users: users.slice(start, start + perPage) }, error: null };
      },
    },
  },
  from: (_table: string) => ({
    select: (_cols: string) => ({
      eq: async (_col: string, value: string) => ({
        data: profiles.filter((p) => p.language === value),
        error: null,
      }),
    }),
  }),
  // @ts-expect-error -- fake client only implements what resolveRecipients uses
} as SupabaseClient;

const recipients = await resolveRecipients(smallFakeAdmin, "en");
assert.equal(recipients.length, 2, "expected 2 English-language recipients");
assert.deepEqual(
  recipients.map((r) => r.email).sort(),
  ["a@example.com", "b@example.com"],
);
assert.equal(recipients.find((r) => r.email === "a@example.com")?.displayName, "Alice");
assert.equal(
  recipients.find((r) => r.email === "b@example.com")?.displayName,
  null,
  "missing display_name normalizes to null",
);

// -- Scenario 2: pagination continues across a full page and stops on a short one --
const manyUsers = Array.from({ length: 1001 }, (_, i) => ({
  id: `m${i}`,
  email: `m${i}@example.com`,
}));
let manyListCalls = 0;
const manyFakeAdmin = {
  auth: {
    admin: {
      listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
        manyListCalls += 1;
        const start = (page - 1) * perPage;
        return { data: { users: manyUsers.slice(start, start + perPage) }, error: null };
      },
    },
  },
  from: () => ({
    select: () => ({
      eq: async () => ({
        data: [{ user_id: "m0", display_name: null, language: "en" }],
        error: null,
      }),
    }),
  }),
  // @ts-expect-error -- fake client only implements what resolveRecipients uses
} as SupabaseClient;

await resolveRecipients(manyFakeAdmin, "en");
assert.equal(
  manyListCalls,
  2,
  "expected pagination to continue past a full 1000-user page and stop on the next (short) page",
);

console.log("recipients.ts verification: OK");
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/lib/email/__verify_recipients.ts`
Expected: module-not-found — `recipients.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/email/recipients.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLanguage } from "./greeting";

export interface EmailRecipient {
  email: string;
  displayName: string | null;
}

const LIST_USERS_PAGE_SIZE = 1000;

async function buildEmailMap(admin: SupabaseClient): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });
    if (error) throw new Error(`Failed to list users: ${error.message}`);

    for (const user of data.users) {
      if (user.email) emailByUserId.set(user.id, user.email);
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
    page += 1;
  }

  return emailByUserId;
}

/**
 * Resolves every registered user whose saved profiles.language matches
 * `language`, joined against their auth.users email (profiles has no email
 * column -- this is the only supported way to get one). Profiles with no
 * matching auth user are skipped defensively -- shouldn't happen given the
 * FK + cascade delete on profiles.user_id, but never crash a bulk send
 * over it.
 */
export async function resolveRecipients(
  admin: SupabaseClient,
  language: EmailLanguage,
): Promise<EmailRecipient[]> {
  const [emailByUserId, profilesResult] = await Promise.all([
    buildEmailMap(admin),
    admin.from("profiles").select("user_id, display_name").eq("language", language),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
  }

  const recipients: EmailRecipient[] = [];
  for (const profile of (profilesResult.data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
  }>) {
    const email = emailByUserId.get(profile.user_id);
    if (!email) continue;
    recipients.push({ email, displayName: profile.display_name ?? null });
  }
  return recipients;
}
```

- [ ] **Step 4: Run it again and confirm it passes**

Run: `npx tsx src/lib/email/__verify_recipients.ts`
Expected: prints `recipients.ts verification: OK`.

- [ ] **Step 5: Delete the throwaway script, lint, and type-check**

```bash
rm src/lib/email/__verify_recipients.ts
npm run lint
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/recipients.ts
git commit -m "feat: add recipient resolution joining auth.users email with profiles.language"
```

---

## Task 6: API route

**Files:**
- Create: `src/app/api/admin/send-email/route.ts`

**Interfaces:**
- Consumes: `isAdminEmail` (Task 1), `EmailLanguage`/`applyGreeting` (Task 2), `createAdminClient` (Task 3), `sendBulkEmail` (Task 4), `resolveRecipients` (Task 5).
- Produces: `POST /api/admin/send-email` accepting `{ language: string; subject?: string; bodyMarkdown?: string; confirm: boolean }`, returning `{ ok: true, dryRun: true, recipientCount: number }` when `confirm` is false, or `{ ok: true, dryRun: false, total: number, sent: number, failed: number }` when `confirm` is true and the send completes, or `{ ok: false, error: string }` (with an appropriate 4xx/5xx status) on any failure. Consumed by Task 7 (`SendEmailForm`).

- [ ] **Step 1: Implement**

Create `src/app/api/admin/send-email/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { resolveRecipients } from "@/lib/email/recipients";
import { applyGreeting, type EmailLanguage } from "@/lib/email/greeting";
import { sendBulkEmail } from "@/lib/email/sendEmail";

const VALID_LANGUAGES: EmailLanguage[] = ["en", "es", "fr"];

interface RequestBody {
  language?: string;
  subject?: string;
  bodyMarkdown?: string;
  confirm?: boolean;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body || !VALID_LANGUAGES.includes(body.language as EmailLanguage)) {
    return Response.json({ ok: false, error: "invalid_language" }, { status: 400 });
  }
  const language = body.language as EmailLanguage;

  try {
    const admin = createAdminClient();
    const recipients = await resolveRecipients(admin, language);

    if (!body.confirm) {
      return Response.json({ ok: true, dryRun: true, recipientCount: recipients.length });
    }

    if (!body.subject?.trim() || !body.bodyMarkdown?.trim()) {
      return Response.json({ ok: false, error: "missing_content" }, { status: 400 });
    }
    const subject = body.subject.trim();
    const bodyMarkdown = body.bodyMarkdown;

    const messages = recipients.map((recipient) => ({
      to: recipient.email,
      subject,
      bodyMarkdown: applyGreeting(bodyMarkdown, language, recipient.displayName),
    }));

    const result = await sendBulkEmail(messages);

    if (result.failed > 0) {
      console.error("Bulk email: some sends failed", result.failures);
    }

    return Response.json({
      ok: true,
      dryRun: false,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    console.error("Bulk email request failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
```

Note: **no** `export const runtime = 'edge'` on this file — per `CLAUDE.md`'s Build/runtime notes, OpenNext doesn't support per-route runtime declarations; the whole app is one Worker.

- [ ] **Step 2: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean.

- [ ] **Step 3: Smoke-test the dry-run path from a browser devtools console**

While logged in as an admin account (or temporarily add your own dev-session email to `ADMIN_EMAILS` in `src/lib/email/adminAllowlist.ts` for local-only testing — **revert that edit before committing**), run `npm run dev`, open `http://localhost:3000/chat`, open the browser devtools console, and run:

```js
fetch("/api/admin/send-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ language: "en", confirm: false }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ ok: true, dryRun: true, recipientCount: <some number> }`. Cross-check that number against `select count(*) from profiles where language = 'en'` in the Supabase SQL editor for your dev project.

Then confirm the 403 path: sign out (or sign in as a non-admin account) and run the same `fetch` call — expected `{ ok: false, error: "unauthorized" }` with a 403 status.

Full send-path QA (with a real confirm) is covered end-to-end in Task 8, once the UI exists.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/send-email/route.ts
git commit -m "feat: add admin bulk-email API route"
```

---

## Task 7: `SendEmailForm` component

**Files:**
- Create: `src/components/admin/SendEmailForm.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/send-email` (Task 6).
- Produces: `export function SendEmailForm(): JSX.Element` — a self-contained component with no props, consumed by Task 8 (`/admin/send-email` page).

- [ ] **Step 1: Implement**

Create `src/components/admin/SendEmailForm.tsx`:

```tsx
"use client";

import { useState } from "react";

type EmailLanguage = "en" | "es" | "fr";

const LANGUAGE_OPTIONS: { code: EmailLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

type Phase = "compose" | "confirming" | "sending" | "done";

interface SendSummary {
  total: number;
  sent: number;
  failed: number;
}

async function postSendEmail(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/admin/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.ok) {
    throw new Error((data.error as string | undefined) || `Request failed (${res.status})`);
  }
  return data;
}

export function SendEmailForm() {
  const [language, setLanguage] = useState<EmailLanguage>("en");
  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [phase, setPhase] = useState<Phase>("compose");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canContinue = subject.trim().length > 0 && bodyMarkdown.trim().length > 0;

  async function handleContinue() {
    setError(null);
    try {
      const data = await postSendEmail({ language, confirm: false });
      setRecipientCount(data.recipientCount as number);
      setConfirmChecked(false);
      setPhase("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleConfirmSend() {
    setError(null);
    setPhase("sending");
    try {
      const data = await postSendEmail({ language, subject, bodyMarkdown, confirm: true });
      setSummary({
        total: data.total as number,
        sent: data.sent as number,
        failed: data.failed as number,
      });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("confirming");
    }
  }

  function handleStartOver() {
    setSubject("");
    setBodyMarkdown("");
    setSummary(null);
    setError(null);
    setPhase("compose");
  }

  if (phase === "done" && summary) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-6 dark:border-zinc-700">
        <h2 className="font-display text-xl text-foreground">Send complete</h2>
        <p className="text-sm text-foreground">
          {summary.sent} sent, {summary.failed} failed, out of {summary.total} recipients.
        </p>
        <button
          type="button"
          onClick={handleStartOver}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-6 dark:border-zinc-700">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as EmailLanguage)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Only sent to users whose saved language preference matches this selection.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Body
          </label>
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            A greeting line is added automatically for each recipient — don&rsquo;t include your
            own &ldquo;Dear...&rdquo; line unless you specifically want it replaced.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue
        </button>
      </div>

      {(phase === "confirming" || phase === "sending") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-[var(--surface-base)] p-6 shadow-xl">
            <h2 className="font-display text-xl text-foreground">Confirm send</h2>
            <p className="text-sm text-foreground">
              You&rsquo;re about to email <strong>{recipientCount}</strong> user
              {recipientCount === 1 ? "" : "s"} in{" "}
              {LANGUAGE_OPTIONS.find((o) => o.code === language)?.label}.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="font-medium text-foreground">{subject}</p>
              <p className="mt-2 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {bodyMarkdown}
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={phase === "sending"}
                className="mt-0.5"
              />
              I&rsquo;ve read this email and confirm it&rsquo;s ready to send.
            </label>
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("compose")}
                disabled={phase === "sending"}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={!confirmChecked || phase === "sending"}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phase === "sending" ? "Sending…" : "Send to all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean. (No visual check yet — this component has no host page until Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/SendEmailForm.tsx
git commit -m "feat: add SendEmailForm compose/confirm UI"
```

---

## Task 8: Page gate, profile button, and full wiring

**Files:**
- Create: `src/app/admin/send-email/page.tsx`
- Modify: `src/app/(auth)/profile/page.tsx`
- Modify: `src/app/(auth)/profile/ProfileContent.tsx`

**Interfaces:**
- Consumes: `isAdminEmail` (Task 1), `SendEmailForm` (Task 7).
- Produces: nothing new for later tasks — this is the final integration point.

- [ ] **Step 1: Create the gated admin page**

Create `src/app/admin/send-email/page.tsx`. This is a **new top-level route**, not nested under the existing `(auth)` group — that group's layout (`src/app/(auth)/layout.tsx`) is a `max-w-sm` centered card sized for login/signup forms, too narrow for this compose form:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { SendEmailForm } from "@/components/admin/SendEmailForm";

export default async function SendEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/chat");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">Send bulk email</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Compose a message and send it to every registered user whose saved language matches
          your selection.
        </p>
      </div>
      <SendEmailForm />
    </div>
  );
}
```

- [ ] **Step 2: Add the admin button to the profile page**

In `src/app/(auth)/profile/page.tsx`, add the `isAdminEmail` import and pass a new `isAdmin` prop:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/languages";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { ProfileContent } from "./ProfileContent";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, language, created_at")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl text-foreground">
          Your profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account settings
        </p>
      </div>

      <ProfileContent
        user={{
          id: user.id,
          email: user.email ?? "",
          displayName: profile?.display_name ?? undefined,
        }}
        currentLanguage={normalizeLanguagePreference(profile?.language)}
        isAdmin={isAdminEmail(user.email)}
      />
    </div>
  );
}

function normalizeLanguagePreference(language?: string | null) {
  return SUPPORTED_LANGUAGES.includes(language ?? "") ? language ?? "en" : "en";
}
```

- [ ] **Step 3: Render the button in `ProfileContent`**

In `src/app/(auth)/profile/ProfileContent.tsx`, add `isAdmin` to the props interface and function signature:

```tsx
interface ProfileContentProps {
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
  currentLanguage: string;
  isAdmin?: boolean;
}

export function ProfileContent({
  user,
  currentLanguage,
  isAdmin = false,
}: ProfileContentProps) {
```

Then insert a new block right before the existing `border-t` "Back to chat" / "Sign out" section:

```tsx
      {isAdmin && (
        <div className="space-y-3">
          <Link
            href="/admin/send-email"
            className="block w-full rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Send bulk email
          </Link>
        </div>
      )}

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
```

(`Link` from `next/link` is already imported in this file — no new import needed. Everything else in the file, including the existing "Back to chat"/"Sign out" block that follows, is unchanged.)

- [ ] **Step 4: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean.

- [ ] **Step 5: Manual QA in the browser**

Run `npm run dev`. **Before doing a real send test below, confirm you are pointed at a dev/staging Supabase project with only test accounts — this feature emails every matching real user with no undo.** Check `.dev.vars`/your local env for which Supabase project URL is configured before proceeding.

- Unauthenticated: visit `http://localhost:3000/admin/send-email` directly — confirm redirect to `/login`.
- Logged in as a non-admin test account: confirm no "Send bulk email" button appears on `/profile`, and visiting `/admin/send-email` directly redirects to `/chat`.
- Logged in as an admin account (a real test user with email exactly `info@branhamsermons.ai` or `admin@branhamsermons.ai` in your dev project — or temporarily add your own dev email to `ADMIN_EMAILS` for local-only testing and **revert that edit before committing**): confirm the button appears on `/profile` and `/admin/send-email` loads the form.
- Click "Continue" with a subject and body filled in — confirm the confirmation modal shows a recipient count matching `select count(*) from profiles where language = 'en'` (or your selected language) in the Supabase SQL editor for your dev project.
- Confirm the "Send to all" button stays disabled until the checkbox is checked.
- Set up two dev/test accounts in the target language — one with a `display_name` set (e.g. via Google OAuth sign-in), one without (Email-OTP signup) — and send a real test email to just that language bucket (small, controlled recipient set). Confirm the received emails show `Dear <name>,` for the first and a plain `Hello,` for the second.
- Compose a body that already starts with `Dear Team,` on its own line, send to the same small test bucket — confirm the received email has exactly one greeting line (the code-generated one), not two.
- Pick a language with zero matching test profiles (if you have one) — confirm the modal shows "You're about to email 0 users" and does not error.
- Temporarily unset `POSTMARK_SERVER_TOKEN` in `.dev.vars`, restart the dev server, attempt a confirmed send — confirm the UI shows an error state (via the top-level `try/catch` in the route, since `sendBulkEmail` returns `failed: total` rather than throwing when the token is missing — the response will show `sent: 0, failed: <total>` in the "Send complete" summary, not a false "0 failed"). Restore the token afterward.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/send-email/page.tsx "src/app/(auth)/profile/page.tsx" "src/app/(auth)/profile/ProfileContent.tsx"
git commit -m "feat: wire admin bulk-email page gate and profile entry point"
```

---

## Self-Review Notes

- **Spec coverage:** Access control (hardcoded allowlist, dual gate) → Tasks 1, 6, 8. Route + dry-run/confirm modes → Task 6. Compose + confirm UX → Task 7. Personalization (strip + prepend + fallback) → Task 2. Recipient resolution (listUsers pagination + profiles join) → Task 5. Batched sequential Postmark sending → Task 4. Cloudflare limits note → Global Constraints (no task needed, it's a non-issue, not a requirement to implement). Out-of-scope items (no audit log, no scheduling, no per-language variants per send, no retry UI) → deliberately absent from every task; called out again here so a reviewer doesn't go looking for them.
- **Placeholder scan:** no TBD/TODO in any step; the one embedded "correction note" in Task 2 Step 1 is intentional — it documents a mistake I caught in my own draft assertion while writing this plan (worth leaving visible so whoever executes it double-checks that specific case rather than trusting it blindly), and gives the corrected code to actually write.
- **Type consistency:** `EmailLanguage` defined once in Task 2, imported by name into Task 5 and Task 6. `EmailRecipient` defined once in Task 5, its two fields (`email`, `displayName`) matched exactly by Task 6's `recipients.map(...)` usage. `BulkEmailMessage`/`BulkSendResult` defined once in Task 4, consumed by exact field name (`result.total`/`result.sent`/`result.failed`/`result.failures`) in Task 6. `isAdminEmail` signature (`(email: string | null | undefined) => boolean`) used identically in Tasks 6 and 8.
