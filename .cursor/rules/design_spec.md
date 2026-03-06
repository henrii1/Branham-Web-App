# Branham Web App — Design Specification (v1)

## Next.js App Router · Supabase · Cloudflare Workers

**Project:** Branham Web App
**Deployment target:** Cloudflare Workers via `@opennextjs/cloudflare` (NOT Vercel)

**Purpose:** A minimal, high-performance ChatGPT-style web app that:
- Authenticates users via **Supabase Auth**
- Persists chat history in **Supabase DB** (logged-in users only)
- Renders model responses as **streamed Markdown** in a two-panel layout (Sources + Chat)
- Makes exactly **one downstream API call per user message** to the **Branham Model API** (Python SSE service)

**v1 language:** English only. Non-English language selections trigger an explanatory modal.
**v1 UX:** No reader view. References are rendered **inline** as styled citation pills on the final chat render.

---

## 0) Non-negotiables (LOCKED)

- Deploy to **Cloudflare Workers** with `@opennextjs/cloudflare`. Do **not** use the deprecated `@cloudflare/next-on-pages`.
- Keep UI simple: **two-panel layout** (Sources top, Chat bottom) + history sidebar.
- Supabase client handles:
  - authentication (sign-in / sign-out / session)
  - chat history CRUD (**logged-in users only**)
- No response or embedding caching in v1.
- The web app makes **only one API call per user message**:
  - `POST /api/chat` (Cloudflare Workers route handler) → proxies to Model API with bearer token
- The Model API bearer token is **never exposed to the client**. It lives in Cloudflare Workers secrets and is injected server-side.
- Everything else is client-side work: SSE parsing, markdown rendering, citation styling.

**Free app v1 constraints:**
- No API key management in v1 (single shared bearer token).
- Support anonymous usage:
  - user can send **one query per conversation** (no follow-ups without login)
  - can start multiple fresh single-query conversations
  - **no DB persistence** — browser memory only
  - page refresh loses all data
- SEO (v1):
  - **English only** for SEO pages
  - curated SEO query cache (no auto-generation)

---

## 1) Deployment: Cloudflare Workers

### 1.1 Why Cloudflare Workers (via `@opennextjs/cloudflare`)
- Global edge network, fast cold starts, generous free tier.
- Workers runtime supports streaming responses (critical for SSE proxy).
- Full Node.js API compatibility via `nodejs_compat` flag (but prefer Web APIs for portability).
- `@cloudflare/next-on-pages` is **deprecated** — `@opennextjs/cloudflare` is the official Cloudflare-recommended replacement.
- Deploys to the same global edge network as Pages, with better Next.js feature coverage (SSR, ISR, Server Actions, Partial Prerendering).

### 1.2 Constraints
- Prefer **Web APIs** over Node.js-specific APIs for portability.
- **No Nodemailer** — use HTTP-based email providers (Postmark in v1).
- **`@supabase/ssr`** works in Workers runtime (uses `fetch`). No issue.
- Do **not** add `export const runtime = 'edge'` — the OpenNext adapter does not support edge runtime declarations. Workers runtime with `nodejs_compat` is the default.
- Use `@opennextjs/cloudflare` adapter for build and deployment. Build config in `wrangler.jsonc`.
- Use `middleware.ts` with `export const runtime = 'edge'` (OpenNext does not yet support Next.js 16 `proxy.ts`; migrate when the Adapters API ships). The Next.js deprecation warning is cosmetic.

### 1.3 Environment variables (Cloudflare Workers secrets + `.env.local`)
- `MODEL_API_BASE_URL` — Branham Model API base URL
- `CHAT_API_BEARER_KEY` — bearer token for Model API (SECRET — never in client bundle)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase secret key (server-side only)
- `POSTMARK_SERVER_TOKEN` — Postmark API token (server-side only)

Server-side secrets are set via `wrangler secret put` (encrypted at rest). Client-side `NEXT_PUBLIC_*` vars go in `wrangler.jsonc` or `.env.local`.

---

## 2) Performance principles

### 2.1 Next.js on Cloudflare Workers
- Prefer **Server Components** by default (App Router).
- Keep interactive surfaces as **Client Components**:
  - chat input (Composer)
  - streaming chat panel
  - Sources (RAG) panel
  - message list
- Avoid heavy client bundles:
  - minimal dependencies
  - no large libraries in client components
  - dynamic import for non-critical widgets

### 2.2 Rendering efficiency
- **Never re-render the full message list** for each streamed token.
- Append delta text to the current assistant message buffer only.
- Re-render markdown at safe boundaries (paragraph `\n\n` or newline `\n`).
- One final full markdown render on stream completion.
- Sources panel renders once per turn (when `rag` event arrives).

### 2.3 DB round-trips
- Fetch conversation list: one query.
- Fetch conversation messages: one query.
- Fetch latest RAG for a conversation: one query.
- UPSERT RAG on each turn: one query.
- No per-reference query loops.

---

## 3) API contract (SSE summary)

Full contract: see `api_contract.md`. Key points summarized here.

### 3.1 Request
```
POST {MODEL_API_BASE_URL}/api/chat
Authorization: Bearer {CHAT_API_BEARER_KEY}
Content-Type: application/json
```

Body:
```json
{
  "conversation_id": "uuid",
  "query": "user message",
  "user_language": "en",
  "conversation_summary": "string or omit on first turn",
  "history_window": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Rules:**
- `conversation_id` and `query` are always required.
- `user_language` is always sent (`"en"` for v1).
- `conversation_summary`: omit on first turn. On follow-ups, send the summary from the **latest** `final` event.
- `history_window`: send the last N messages (oldest → newest). Deterministic truncation.

### 3.2 SSE event sequence
```
start  →  rag (optional)  →  delta (many)  →  final  →  done
```
Error path: `error → done`

| Event | Payload | Notes |
|-------|---------|-------|
| `start` | `{ conversation_id }` | Connection established |
| `rag` | `{ retrieval_query, rag_context, retrieval }` | Arrives ~2-3s. Render in Sources panel immediately. Not emitted on refusals or non-English gate. |
| `delta` | `{ text }` | Append to chat buffer. First delta may be ~5-8s after request. |
| `final` | `{ mode, answer, external_info, conversation_summary }` | Source of truth for full answer. Store `conversation_summary` for next turn. |
| `done` | `{ ok: true }` | Terminal event. Close connection. |
| `error` | `{ mode: "error", answer }` | Show error UI. Do not overwrite existing summary. |

### 3.3 `final` event fields
- `mode`: `"answer"` | `"refusal"` | `"error"`
- `answer`: full final markdown text (authoritative — use this, not concatenated deltas)
- `external_info`: `null` or `{ disclaimer, sources[] }` — already rendered inline in the markdown answer, no separate UI needed
- `conversation_summary`: compact string for next-turn memory handoff. Store in `conversations` table.

### 3.4 "Answer:" prefix dedup (LOCKED)
The model response often begins with `"Answer:"`. **Always strip this prefix** before rendering and before persisting. Apply to both streamed deltas (strip on first delta if it starts with "Answer") and the `final.answer` field.

---

## 4) App behavior overview

### 4.1 Anonymous user (not logged in) — main chat page
1. User opens app. No sidebar. Clean chat UI.
2. User sends a query.
3. `/api/chat` proxies to Model API. RAG arrives → Sources panel. Deltas stream → Chat panel.
4. Response completes. Everything lives in **browser memory only**.
5. If user tries to **follow up** (types in composer):
   - **Login modal** appears: "Sign up to continue the conversation."
   - Modal links to signup page.
6. User can **start a new conversation** (new single query) without logging in. No limit on fresh conversations.
7. Page refresh → all data lost.

### 4.2 Anonymous user — SEO page (`/q/[slug]`)
1. User lands on SEO page (e.g., from Google).
2. Cached answer renders with **typewriter effect** (simulated streaming from DB).
3. Cached RAG context renders in Sources panel.
4. If user tries to follow up:
   - **Login modal**: "Sign up to follow up on this question."
   - Signup link includes a reference to the SEO slug (query param or localStorage).
5. After signup → language selection → user is redirected to `/chat/[conversationId]`.
   - A new `conversations` row is created, seeded with the SEO question as the first user message and the cached answer as the first assistant message.
   - The cached RAG is stored in `conversation_rag`.
   - The cached `conversation_summary` is stored on the conversation.
   - User can now follow up normally.

### 4.3 Logged-in user — main chat page
1. Sidebar shows conversation history.
2. User starts a new chat or resumes an existing one.
3. Sending a message:
   - Creates `conversations` row (if new).
   - Creates `chat_messages` row for user message.
   - `/api/chat` fires with `conversation_summary` (if follow-up) + `history_window` + `user_language`.
   - RAG → Sources panel. Deltas → Chat panel.
   - On `final`: persist assistant message, UPSERT RAG, update `conversation_summary` on conversation.
4. Loading a previous conversation:
   - Fetch all messages → render in Chat panel.
   - Fetch latest RAG → render in Sources panel.

### 4.4 Login/signup flow
1. User clicks "Sign up" (from modal or sidebar).
2. **Signup providers**: Google OAuth, Email OTP (magic link via Supabase Auth).
3. After account creation → **Language selection** screen.
   - If user picks a non-English language: **modal** explains "Only English is supported for now. We're working on extending to your language."
   - Language is stored in `profiles.language`.
4. After language selection → redirect to **chat page** immediately.
5. **Welcome email** fires async in the background (Postmark HTTP API).
   - Only sent if `profiles.welcome_email_sent_at IS NULL`.
   - On success, set `welcome_email_sent_at`.

### 4.5 "Finalizing Response" state
- After the `rag` event is rendered in Sources:
  - Chat panel shows a greyed-out placeholder: *"Finalizing response…"*
- When the first `delta` arrives:
  - Placeholder is replaced with streaming content.
- If no `rag` event (refusal/error path):
  - Chat panel shows a loading spinner until first `delta` or `error`.

---

## 5) UI layout

### 5.1 Large screens (desktop / tablet)

```
┌──────────────┬───────────────────────────────────┐
│              │  ┌───────────────────────────────┐ │
│  Sidebar     │  │  Sources (RAG) panel          │ │
│  (history)   │  │  — rendered markdown           │ │
│              │  │  — drag handle ═══════════════ │ │
│              │  │  Chat panel                    │ │
│              │  │  — streaming markdown           │ │
│              │  │  — citation pills (final only) │ │
│              │  ├───────────────────────────────┤ │
│              │  │  Composer (input box)          │ │
│              │  └───────────────────────────────┘ │
└──────────────┴───────────────────────────────────┘
```

- **Sidebar** (~1/5 width): conversations list, new chat button, sign in/out (or Sign up/Log in when anonymous).
- **Main panel**: vertically split into Sources (top) and Chat (bottom).
- **Drag-to-resize**: vertical divider between Sources and Chat. Height changes only, width stays constant. Default split: ~40% Sources / 60% Chat. Minimum height for each panel (~15% of viewport).
- **Composer**: anchored at bottom, always visible.
- Anonymous users: sidebar visible with empty history ("Sign in to save history"); can start new chat but no persistence.

### 5.2 Small screens (phones)

- **Tab interface**: two tabs — `Chat` | `Sources`.
- **Smart auto-switching per turn:**
  1. User sends query → loading state on both tabs.
  2. `rag` event arrives → auto-switch to **Sources tab**. RAG content renders.
  3. First `delta` arrives → auto-switch to **Chat tab**. Streaming begins. Sources tab shows a green badge.
  4. After that, user can freely toggle tabs.
- Composer anchored at bottom.
- Sidebar is a hamburger drawer.

### 5.3 Accessibility
- Keyboard navigation for conversation list.
- Enter to send, Shift+Enter for newline.
- Good contrast, readable typography.
- ARIA labels on panels and tabs.

---

## 6) Streaming & rendering pipeline

### 6.1 SSE parsing (client-side)
1. Connect to `/api/chat` (POST, SSE).
2. Parse events using `EventSource` or manual `ReadableStream` + line parser.
3. On `start`: initialize turn state.
4. On `rag`: render `rag_context` markdown in Sources panel. Show "Finalizing response…" in Chat.
5. On `delta`: append `text` to chat buffer. Re-render markdown at safe boundaries (`\n\n` preferred, `\n` acceptable).
6. On `final`: do one final full markdown render of `final.answer` (after stripping "Answer:" prefix). Apply citation CSS styling. Persist data (logged-in only).
7. On `done`: close connection. Clean up loading states.
8. On `error`: show error UI. Do not clear existing conversation summary.

### 6.2 Final render vs. stream render
- During streaming: render deltas as plain markdown (no citation styling).
- On `final`: replace streamed content with `final.answer` rendered with full citation styling.
- This avoids regex/DOM manipulation on every token.

### 6.3 Both panels render markdown
- Sources panel: renders `rag_context` as markdown (received as a single string).
- Chat panel: renders assistant messages as markdown.
- Both use the same sanitized markdown renderer (`marked` with custom security renderer).

### 6.4 RAG context postprocessing (before markdown render)
Applied to `rag_context` before rendering in Sources panel. Cleans up PDF-layout artifacts.

**Inline sermon title dedup:**
- Sermon titles appear in ALL CAPS within chunk text (e.g., `THE SERPENT'S SEED 23`).
- These are page-header artifacts from the PDF layout, not part of the sermon prose.
- Titles are extracted from the RAG section headers (`### N. TITLE — DATE_ID`).
- Each title is removed when it appears inline in chunk text, optionally followed by a page number.
- Section headers themselves are **not** modified.

**"THE SPOKEN WORD" dedup:**
- Remove `THE SPOKEN WORD` if present in all caps anywhere in RAG context.

**Sermon boilerplate removal:**
- Remove sermon reference/ending blocks that leak into chunk context, including:
  - Date_ID + sermon name line (e.g., `57-0915E Hebrews, Chapter Seven #1`)
  - Location (e.g., `Branham Tabernacle`, `Jeffersonville, Indiana U.S.A.`)
  - `ENGLISH`, `©YYYY VGR, ALL RIGHTS RESERVED`
  - `VOICE OF GOD RECORDINGS`, `P.O. BOX 950`, `www.branham.org`
  - Copyright Notice text block
- Detection: when boilerplate markers are found, expand to the nearest date_id line above and remove the entire block.

### 6.5 Chat response formatting (before markdown render)
Applied to assistant answers before markdown rendering in Chat panel.

**Section dividers:**
- Insert a markdown horizontal rule (`---`) above these section headings when present:
  - `### Quotes` / `## Quotes`
  - `### References` / `## References`
  - `### Reader Note` / `## Reader Note`
- Idempotent — safe to apply multiple times (won't double-add rules).
- This visually separates the main answer from supporting sections.

---

## 7) Markdown sanitization (LOCKED)

**Policy:**
- Allow safe subset: paragraphs, emphasis, strong, lists, blockquotes, links, headings, code blocks.
- **Disallow all raw HTML** and HTML passthrough.
- Links:
  - Allow only `http://` and `https://` schemes.
  - Add `rel="noopener noreferrer"` and `target="_blank"` to all links.
- Never execute scripts or unsafe URL schemes (`javascript:`, `data:`, etc.).

---

## 8) Citation styling (LOCKED — chat panel only)

### 8.1 Citation format
Citations appear in assistant answers as:
```
[SERMON TITLE — DATE_ID: ¶X–¶Y]
```
Example: `[INVESTMENTS — 63-1116B: ¶232–¶235]`

### 8.2 Detection
- Regex pattern on the **final rendered answer only** (not during streaming).
- Match: `\[` + text containing ` — ` + date pattern + `:` + paragraph range + `\]`
- Be tolerant of spacing and dash variants (`–`, `-`, `—`).

### 8.3 Rendered style (CSS pill)
```
┌──────────────────────────────────────────────┐
│  INVESTMENTS — 63-1116B  ¶232–¶235           │
└──────────────────────────────────────────────┘
```
- Inline element (`<span>`) replacing the raw `[...]` token.
- Thin border (1px solid, muted grey).
- Slightly rounded corners (border-radius ~6px).
- No background color (transparent).
- Font: slightly smaller, monospace or system mono.
- Subtle hover effect (border darkens slightly).
- Applied **only in the Chat panel**, not in Sources.

### 8.4 `Evidence:` label styling (LOCKED)
In many answers, citations are grouped after a sentence as:
`Evidence: [REF A]; [REF B]; [REF C].`

`Evidence:` is metadata, not prose. It must be visually separated from sentence text.

Rendering rules on final chat render:
- Detect `Evidence:` blocks and wrap them in an evidence row/container.
- Render `Evidence:` as a dedicated label chip/badge (not plain inline text).
- Render each square-bracket reference token as a citation pill (same style as §8.3).
- Keep semicolon-separated references visually grouped with consistent spacing.
- Preserve punctuation in content, but do not style trailing punctuation as part of citation pills.
- Apply this behavior in the Chat panel only (not Sources panel).

Recommended structure:
- `<span class=\"evidence-label\">Evidence</span>`
- `<span class=\"citation-pill\">[INVESTMENTS — 63-1116B: ¶232–¶235]</span>`
- Repeat citation pills for all evidence references in that sentence.

---

## 9) Data modeling (Supabase)

### 9.1 `conversations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | = conversation_id |
| `user_id` | uuid, FK → auth.users | Required for persisted conversations |
| `title` | text, nullable | Auto-generated or user-set |
| `conversation_summary` | text, nullable | Updated after each turn from `final.conversation_summary` |
| `created_at` | timestamptz | Default now() |
| `updated_at` | timestamptz | Updated on each new message |

### 9.2 `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `conversation_id` | uuid, FK → conversations.id | |
| `user_id` | uuid, FK → auth.users | Required for persisted messages |
| `role` | text | `'user'` or `'assistant'` |
| `content` | text | Stored as markdown for assistant messages. "Answer:" prefix already stripped. |
| `created_at` | timestamptz | Default now(). Message order is by created_at ASC. |

**Rules:**
- Persist assistant message **only after stream completion** (from `final.answer`).
- No partial message rows.

### 9.3 `conversation_rag`
| Column | Type | Notes |
|--------|------|-------|
| `conversation_id` | uuid, PK, FK → conversations.id | One-to-one with conversation |
| `rag_context` | text | Full markdown from `rag` event |
| `retrieval_query` | text | The query used for retrieval |
| `retrieval_metadata` | jsonb, nullable | Stats: hit counts, signals, should_refuse, etc. |
| `updated_at` | timestamptz | |

**Rules:**
- **UPSERT** on each turn (INSERT ON CONFLICT UPDATE). Only the latest RAG is kept.
- When loading a conversation from history: fetch messages + latest RAG.

### 9.4 `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid, PK, FK → auth.users | |
| `display_name` | text, nullable | |
| `language` | text | Required. Default `'en'`. Editable in profile. |
| `welcome_email_sent_at` | timestamptz, nullable | Send-once guard |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 9.5 `seo_cache`
| Column | Type | Notes |
|--------|------|-------|
| `slug` | text, PK | URL slug for `/q/[slug]` |
| `question` | text | User-facing SEO question (basic query) |
| `robust_query` | text | Enhanced query sent to Model API for better answer |
| `answer_markdown` | text | Cached full answer from API (with "Answer:" stripped) |
| `rag_context` | text | Cached RAG context from API |
| `conversation_summary` | text, nullable | From `final.conversation_summary` |
| `language` | text | Default `'en'`. v1 = English only. |
| `published` | boolean | Default false. Only published = indexable. |
| `meta_title` | text, nullable | SEO meta title |
| `meta_description` | text, nullable | SEO meta description |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Rules:**
- Manually curated only. No on-the-fly API calls for SEO page rendering.
- Only `published = true` pages are indexable.
- User provides both `question` (basic) and `robust_query` (enhanced). API is called with `robust_query`. Stored results serve as the SEO page content.

### 9.6 `sermon_metadata` (optional in v1)
| Column | Type | Notes |
|--------|------|-------|
| `date_id` | text, PK | |
| `title` | text | |
| `preacher` | text | Default "William Marrion Branham" |
| `language` | text | Default "en" |
| `created_at` | timestamptz | |

Pre-seeded from corpus pipeline. Optional for future citation tooltip enhancements.

### 9.7 `intro_messages` (optional — for email templates)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `language` | text | |
| `subject` | text | Email subject line |
| `body_markdown` | text | Email body content |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Used by the welcome email sender. v1 ships with English content only.

---

## 10) Supabase setup (RLS, indexes, policies)

### 10.1 Row Level Security policies (LOCKED)

**conversations:**
- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()`
- `UPDATE`: `user_id = auth.uid()`
- `DELETE`: `user_id = auth.uid()`

**chat_messages:**
- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()`
- `UPDATE`: none (messages are immutable after creation)
- `DELETE`: `user_id = auth.uid()`

**conversation_rag:**
- `SELECT`: via join — `conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())`
- `INSERT`: same join check
- `UPDATE`: same join check
- `DELETE`: same join check

**profiles:**
- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()`
- `UPDATE`: `user_id = auth.uid()`

**seo_cache:**
- `SELECT`: public, but only where `published = true`
- No INSERT/UPDATE/DELETE via client (admin only, use service role key or Supabase dashboard)

**sermon_metadata:**
- `SELECT`: public (all rows)
- No INSERT/UPDATE/DELETE via client

**intro_messages:**
- `SELECT`: public (for email template fetching)
- No INSERT/UPDATE/DELETE via client

### 10.2 Indexes
- `conversations`: index on `(user_id, updated_at DESC)` — sidebar query
- `chat_messages`: index on `(conversation_id, created_at ASC)` — message loading
- `chat_messages`: index on `(user_id)` — RLS performance
- `conversation_rag`: PK on `conversation_id` is sufficient (one-to-one)
- `seo_cache`: index on `(published, language)` — sitemap/listing queries
- `seo_cache`: PK on `slug` is sufficient for page loads

### 10.3 Supabase Auth configuration
- Enable **Google OAuth** provider
- Enable **Email OTP** (magic link) provider
- Configure redirect URLs for Cloudflare Workers custom domain
- Set up auth email templates in Supabase dashboard

---

## 11) Security (LOCKED)

### 11.1 API key protection
- `CHAT_API_BEARER_KEY` is stored as a **Cloudflare Workers secret** (encrypted at rest, server-side only, set via `wrangler secret put`).
- The `/api/chat` route handler (Workers function) injects the bearer token into the upstream request.
- The token **never** appears in client-side JavaScript bundles, network requests visible to the browser, or source maps.
- The client calls `/api/chat` (same-origin), not the Model API directly.

### 11.2 Supabase security
- RLS enabled on all tables (see §10.1).
- Service role key used only in server-side route handlers, never in client code.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (limited by RLS).

### 11.3 Rate limiting
- Anonymous `/api/chat` requests: simple rate limit (e.g., 10 requests/minute per IP).
- Implement via Cloudflare rate limiting rules or in-function IP tracking.
- Logged-in users: higher or no rate limit in v1.

### 11.4 General
- Store minimal PII (only email, display name, language).
- Sanitize all markdown output (see §7).
- Never execute user-provided scripts.

---

## 12) SEO pages

### 12.1 Routing
- Public route: `/q/[slug]`
- Loads from `seo_cache` by slug.
- Renders cached answer with **typewriter effect** (simulated streaming animation from DB content).
- Renders cached `rag_context` in Sources panel.
- Both panels active, same layout as live chat.

### 12.2 Typewriter effect
- The answer markdown is split into chunks (by paragraph or sentence).
- Chunks are revealed progressively with a short delay to simulate streaming.
- On completion: apply citation CSS styling to the full answer.

### 12.3 Follow-up behavior
- **Not logged in**: typing in composer triggers login modal. After signup, SEO content seeds a new conversation (see §4.2).
- **Logged in**: creates a new `conversations` row seeded with SEO content. User follow-up triggers live `/api/chat`.

### 12.4 Indexing controls (LOCKED)
- Only `seo_cache.published = true` pages are indexable.
- All `/chat/...` routes are **noindex, nofollow**.
- Unpublished slugs return **404**.
- Generate sitemap from published `seo_cache` rows.

### 12.5 SEO content workflow
- **Stage**: user provides `question` (basic) and `robust_query` (enhanced) for each FAQ.
- **Seed script** (`scripts/seed-seo.ts`): takes the list of question + robust_query pairs, calls the Model API with each `robust_query`, parses the SSE response (rag, final events), and upserts into `seo_cache` with:
  - `slug`: auto-generated from question (lowercase, hyphenated, e.g., "what-is-the-serpents-seed")
  - `answer_markdown`: from `final.answer` (with "Answer:" prefix stripped)
  - `rag_context`: from `rag` event
  - `conversation_summary`: from `final.conversation_summary`
  - `meta_title`: auto-generated (e.g., `"{question} | Branham Sermons AI"`)
  - `meta_description`: auto-generated (first ~155 characters of the answer, plain text)
  - `published`: set to `true`
- Page displays `question` as the `<h1>` heading, `answer_markdown` + `rag_context` as content.

### 12.6 FAQ index page (`/faq`)
- Public route: `/faq`
- Server-rendered page listing all published `seo_cache` entries.
- Layout: **accordion cards** — each card shows the `question` as the heading; click to expand reveals a truncated excerpt of the answer (first ~2-3 sentences, plain text). A "Read full answer" link navigates to `/q/[slug]`.
- Accordion pattern allows legitimate use of `FAQPage` JSON-LD schema (Google requires answers to be visible on-page for rich snippet eligibility).
- The page is entirely auto-generated from published `seo_cache` rows — no manual curation beyond the initial seed.
- Page metadata: `<title>Frequently Asked Questions | Branham Sermons AI</title>`, appropriate meta description.

### 12.7 Structured data (JSON-LD)

**Per-question pages (`/q/[slug]`):**
- Embed `QAPage` schema in a `<script type="application/ld+json">` tag.
- Auto-generated from `seo_cache` fields — no extra input needed.
- Structure:
```json
{
  "@context": "https://schema.org",
  "@type": "QAPage",
  "mainEntity": {
    "@type": "Question",
    "name": "{question}",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "{first ~300 words of answer, plain text}"
    }
  }
}
```

**FAQ index page (`/faq`):**
- Embed `FAQPage` schema containing all published Q&A pairs.
- Structure:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{question}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{truncated answer excerpt}"
      }
    }
  ]
}
```

### 12.8 Open Graph & social meta tags
- Applied via Next.js `generateMetadata` on each `/q/[slug]` page and the `/faq` page.
- All derived from existing `seo_cache` columns — no extra input needed.
- Tags:
  - `og:title` → `meta_title`
  - `og:description` → `meta_description`
  - `og:url` → canonical URL (`https://branhamsermons.ai/q/{slug}`)
  - `og:type` → `"article"`
  - `og:image` → app logo / OG brand image (`/og-image.png`)
  - `og:site_name` → `"Branham Sermons AI"`
  - `twitter:card` → `"summary_large_image"`
  - `twitter:title` → `meta_title`
  - `twitter:description` → `meta_description`
  - `twitter:image` → same OG image

### 12.9 Canonical URLs
- Every `/q/[slug]` page includes `<link rel="canonical" href="https://branhamsermons.ai/q/{slug}" />`.
- The `/faq` page includes `<link rel="canonical" href="https://branhamsermons.ai/faq" />`.
- Set via `generateMetadata` → `alternates.canonical`.

### 12.10 `robots.txt` and sitemap
- Static `public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /chat/
Disallow: /login
Disallow: /signup
Disallow: /onboarding/
Disallow: /profile
Disallow: /api/

Sitemap: https://branhamsermons.ai/sitemap.xml
```
- `sitemap.xml`: dynamically generated from published `seo_cache` rows (Next.js `sitemap.ts` convention). Includes `/faq` and all `/q/[slug]` URLs with `lastmod` from `updated_at`.

### 12.11 Semantic heading hierarchy
- Each `/q/[slug]` page uses a single `<h1>` for the question text.
- Answer content rendered under `<h2>`/`<h3>` headings as they appear in the markdown.
- The `/faq` page uses `<h1>` for the page title ("Frequently Asked Questions") and `<h2>` for each question in the accordion.

---

## 13) Signup, language selection, and welcome email

### 13.1 Signup providers
- Google OAuth
- Email OTP / magic link (Supabase Auth)

### 13.2 Language selection (required)
- Immediately after account creation:
  - User selects preferred language.
  - Stored in `profiles.language`.
- If user selects a non-English language:
  - **Modal**: "Only English is supported right now. We're actively working to extend support to your language in upcoming updates."
  - Language is still saved (for future use). User proceeds to chat.
- Language is editable later on the profile page.

### 13.3 Post-signup redirect
- After language selection → redirect to **chat page** immediately (no welcome page).
- If the signup originated from an SEO page (slug stored in query param or localStorage):
  - Create a conversation seeded with SEO content.
  - Redirect to `/chat/[conversationId]`.
- Otherwise: redirect to `/chat` (fresh chat page).

### 13.4 Welcome email (send-once, async)
- Fires in the background after redirect (non-blocking).
- Sent via **Postmark HTTP API** from a Workers route handler (`/api/welcome-email`).
- Guard: only send if `profiles.welcome_email_sent_at IS NULL`.
- On success: set `profiles.welcome_email_sent_at` to current timestamp.
- Email content sourced from `intro_messages` table (English for v1).
- Provider abstraction: `sendWelcomeEmail()` function wraps Postmark. Swappable later.

---

## 14) App logo

- Concept: a **circular icon** (ChatGPT-style) positioned under/within an **open book** shape.
- Represents: AI chat (circle) grounded in scripture/sermons (book).
- Used as: favicon, sidebar header, mobile PWA icon, Open Graph image.

---

## 15) Codebase structure

```
branham-web-app/
├── README.md
├── next.config.ts
├── wrangler.jsonc                      # Cloudflare Workers config
├── open-next.config.ts                 # OpenNext adapter config
├── .env.local                          # Local dev env vars
├── .dev.vars                           # Cloudflare local dev vars
├── scripts/
│   └── seed-seo.ts                    # Calls Model API, populates seo_cache
├── public/
│   ├── _headers                        # Static asset cache headers
│   ├── robots.txt                      # Crawler directives + sitemap reference
│   ├── og-image.png                    # Default Open Graph brand image
│   ├── logo.svg
│   └── favicon.ico
├── supabase/
│   └── migrations/                     # SQL migrations (pushed via supabase db push)
├── src/
│   ├── middleware.ts                    # Auth session refresh + route protection (edge runtime; migrate to proxy.ts when OpenNext supports it)
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (Server Component)
│   │   ├── page.tsx                    # Landing / redirect to chat
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── onboarding/
│   │   │   │   └── language/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── (app)/
│   │   │   ├── chat/page.tsx           # New chat
│   │   │   ├── chat/[conversationId]/page.tsx
│   │   │   ├── q/[slug]/page.tsx       # SEO pages (QAPage JSON-LD)
│   │   │   └── faq/page.tsx            # FAQ index (FAQPage JSON-LD, accordion)
│   │   ├── sitemap.ts                  # Dynamic sitemap from seo_cache
│   │   └── api/
│   │       ├── chat/route.ts           # SSE proxy to Model API
│   │       └── welcome-email/route.ts  # Postmark email sender
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatShell.tsx           # Main layout: panels + composer
│   │   │   ├── SourcesPanel.tsx        # RAG content panel (top)
│   │   │   ├── ChatPanel.tsx           # Chat messages panel (bottom)
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── Composer.tsx            # Input box
│   │   │   ├── DragDivider.tsx         # Resizable panel divider
│   │   │   ├── ConversationSidebar.tsx
│   │   │   ├── AnonymousBanner.tsx
│   │   │   ├── LoginModal.tsx          # "Sign up to continue" modal
│   │   │   └── CitationPill.tsx        # Styled citation span
│   │   ├── auth/
│   │   │   ├── AuthGate.tsx
│   │   │   ├── LanguagePicker.tsx
│   │   │   └── LanguageOnlyModal.tsx   # "English only" modal
│   │   └── seo/
│   │       └── TypewriterRenderer.tsx  # Simulated streaming for SEO pages
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser client
│   │   │   ├── server.ts              # Server client (cookie-based sessions)
│   │   │   └── middleware.ts           # Session update helper (used by proxy.ts)
│   │   ├── modelApi/
│   │   │   └── client.ts              # SSE fetch + stream wrapper
│   │   ├── markdown/
│   │   │   ├── render.ts              # Markdown → safe HTML (marked + custom renderer)
│   │   │   ├── citations.ts           # Detect + style citation pills & Evidence labels
│   │   │   ├── ragPostprocess.ts      # Clean RAG context (inline title dedup, boilerplate removal)
│   │   │   └── chatPostprocess.ts     # Format chat response (--- dividers above sections)
│   │   ├── sse/
│   │   │   └── parser.ts              # SSE event stream parser
│   │   ├── db/
│   │   │   └── queries.ts             # Typed Supabase query helpers
│   │   ├── email/
│   │   │   └── sendWelcomeEmail.ts    # Postmark provider abstraction
│   │   └── utils/
│   │       ├── ids.ts
│   │       ├── time.ts
│   │       └── answerDedup.ts         # Strip "Answer:" prefix
│   └── styles/
│       └── globals.css
```

---

## 16) Implementation stages

### Stage 0 — Project setup + Supabase provisioning ✅
- Initialize Next.js app (App Router, TypeScript, Tailwind CSS)
- Configure `@opennextjs/cloudflare` adapter + `wrangler.jsonc`
- Create all Supabase tables (conversations, chat_messages, conversation_rag, profiles, seo_cache, sermon_metadata, intro_messages)
- Apply all RLS policies (§10.1)
- Create all indexes (§10.2)
- Create `handle_new_user` trigger (auto-creates profile on signup)
- Configure Supabase Auth providers (Google OAuth, Email OTP)
- Set up Cloudflare Workers project + secrets
- Configure custom domain (`branhamsermons.ai`)
- Verify local dev environment works end-to-end

### Stage 1 — Auth + signup flow
- Supabase client/server setup (`client.ts`, `server.ts`, `middleware.ts` helper used by `src/middleware.ts`)
- Login page (Google OAuth + Email OTP)
- Signup page
- Language selection (onboarding page)
- "English only" modal for non-English selections
- Profiles table integration (create profile on signup)
- Post-signup redirect to chat page
- AuthGate component

### Stage 2 — Core chat UI (two-panel layout)
- ChatShell layout: sidebar + Sources panel + Chat panel + Composer
- DragDivider (vertical resize, height only, minimum floors)
- Mobile tab interface (Chat | Sources) with smart auto-switching
- MessageList, MessageBubble components
- AnonymousBanner ("Sign in to save history")
- LoginModal ("Sign up to continue the conversation")
- Anonymous memory-only state management

### Stage 3 — `/api/chat` SSE proxy + streaming integration
- Implement `/api/chat` route handler
- Inject bearer token server-side (never exposed to client)
- SSE parser (client-side): handle start, rag, delta, final, done, error events
- Stream rendering pipeline: delta buffer → safe-boundary markdown render
- SourcesPanel: render `rag_context` on `rag` event
- "Finalizing response…" placeholder state in Chat panel
- "Answer:" prefix stripping (answerDedup utility)
- Final render: replace streamed content with `final.answer` + citation styling

### Stage 4 — Persistence (logged-in users) ✅
- Conversation creation + sidebar listing
- ConversationSidebar component (grouped by Today/Yesterday/7d/30d/Older)
- Save user message on send (fire-and-forget, non-blocking)
- Save assistant message on stream completion (from `final.answer`)
- UPSERT `conversation_rag` on each turn
- Store `conversation_summary` on conversations table
- Send `conversation_summary` + `history_window` + `user_language` on follow-ups
- Load conversation history (messages + latest RAG) on sidebar click
- URL management: `window.history.replaceState` for in-app navigation (no full re-render)
- DB query helpers in `src/lib/db/queries.ts`

### Stage 5 — Markdown sanitization + citation styling + postprocessing ✅
- Lock safe markdown subset (§7): `marked` with custom renderer, raw HTML stripped
- Disable raw HTML: custom `html()` renderer returns empty string
- Link safety rules: only http/https, adds `rel="noopener noreferrer"` + `target="_blank"`
- Citation detection regex on final render (`applyCitations` in `citations.ts`)
- `Evidence:` label detection + evidence-label chip rendering
- Citation pill CSS styling (inline `<span>`, thin border, rounded corners, monospace font, §8)
- Apply only in Chat panel, not Sources
- RAG postprocessing before markdown render (§6.4)
- Chat response formatting: `---` dividers above Quotes/References/Reader Note sections (§6.5)
- Tailwind Typography plugin (`@tailwindcss/typography`) for prose styling

### Stage 6 — SEO pages
- **User provides**: list of `question` + `robust_query` pairs
- `scripts/seed-seo.ts`: calls Model API with each `robust_query`, parses SSE, upserts into `seo_cache` with auto-generated slug, meta_title, meta_description
- `/q/[slug]` SSR page: loads from `seo_cache`, `<h1>` for question
- TypewriterRenderer for simulated streaming effect
- Follow-up behavior: login modal → signup → seed conversation from SEO content
- `/faq` index page: accordion cards for all published questions, expandable excerpts, links to `/q/[slug]`
- `QAPage` JSON-LD on each `/q/[slug]` page (§12.7)
- `FAQPage` JSON-LD on `/faq` page (§12.7)
- Open Graph + Twitter card meta tags via `generateMetadata` (§12.8)
- Canonical URLs on all SEO pages (§12.9)
- `public/robots.txt` + dynamic `sitemap.ts` (§12.10)
- Noindex on all non-SEO routes (`/chat/...`, `/login`, `/signup`, etc.)
- 404 for unpublished slugs

### Stage 7 — Welcome email
- `sendWelcomeEmail()` abstraction (Postmark HTTP API)
- `/api/welcome-email` route handler
- Fire async after signup redirect (non-blocking)
- `welcome_email_sent_at` guard
- Email content from `intro_messages` table (English)

### Stage 8 — Rate limiting + security hardening
- Anonymous rate limiting on `/api/chat` (Cloudflare rate limiting or in-function)
- Verify all RLS policies work correctly
- Verify bearer token is never exposed in client bundles or network tab
- Verify markdown sanitization blocks all XSS vectors
- Verify noindex is applied on all chat routes
- **User provides**: release notes (static markdown in repo)

### Stage 9 — UI polish, miscellaneous improvements & logo
- Design and integrate app logo (favicon, sidebar header, mobile PWA icon, Open Graph image — see §14)
- UI refinements and visual polish across all screens (spacing, typography, colors, transitions)
- Accessibility audit: keyboard navigation, ARIA labels, focus rings, contrast ratios
- Mobile responsiveness review and fixes (tab switching, sidebar drawer, composer behavior)
- Loading states and skeleton screens where missing
- Error states and empty states polish (no conversations yet, network errors, etc.)
- Minor bug fixes and UX improvements surfaced during development

### Stage 10 — Supabase plan upgrade
- Upgrade Supabase project to Pro plan (or appropriate paid tier)
- Increase auth email rate limits (rate limits are low on free tier: ~3 emails/hour)
- Configure custom SMTP for auth emails (optional, improves deliverability)
- Review and tune Supabase connection pooling for production load

### Stage 11 — Cloudflare production deployment
- **Domain verification**: confirm `branhamsermons.ai` DNS zone is active and verified in Cloudflare dashboard
- **SSL/HTTPS**: ensure edge certificate is issued and valid; set SSL mode to Full (strict); confirm ACME challenge path (`/.well-known/acme-challenge/*`) is not blocked by Workers or Access policies
- **Enable Cloudflare Web Analytics**: one-click enable in Workers & Pages → project → Metrics; auto-injects JS snippet on next deployment (no code changes needed, requires valid HTML output)
- **Verify all Workers secrets**: run `wrangler secret put` for `CHAT_API_BEARER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTMARK_SERVER_TOKEN` and any other server-side secrets
- **Verify production environment variables**: confirm `NEXT_PUBLIC_*` vars and `MODEL_API_BASE_URL` in `wrangler.jsonc`
- **Configure Supabase Auth redirect URLs**: add production custom domain to Supabase Auth allowed redirect URLs
- **Final deployment**: `npx opennextjs-cloudflare build && wrangler deploy`
- **Production smoke test**: end-to-end verification of auth flow, chat streaming, DB persistence, rate limiting, citation rendering, and SEO pages
- **DNS propagation check**: confirm domain resolves correctly, HTTPS padlock shows, no mixed content warnings

---

## 17) Out of scope for v1 (LOCKED)

- Full sermon reader view (deep linking into text)
- Response caching layer
- Offline / PWA support
- Advanced analytics dashboards
- Multi-tenant admin console
- Auto-generation of SEO pages (v1 is curated only)
- Multi-language support beyond English (language field is stored for future use)
- Conversation summarization by the web app (summary comes from Model API)
- Migration of anonymous sessions on login
