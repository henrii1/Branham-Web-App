# CLAUDE.md

Guidance for agents working in this repository. The full design lives in `.cursor/rules/design_spec.md`; the SSE contract this app consumes lives in `api_contract.md`. The backend it talks to is at `/Users/emeraldhenry/Branham-LLM-AI-API` — read that repo's `CLAUDE.md` whenever a change here touches the network contract.

## Project Overview

Branham Web App — Next.js 16 (App Router) + React 19 + Supabase frontend for `branhamsermons.ai`. It is the user-facing chat client; the **only** AI endpoint it calls is the Branham LLM API (a private Cloud Run service). All chat traffic is proxied through a same-origin server route so the API bearer token never enters the browser bundle.

Deployed to **Cloudflare Workers** via the `@opennextjs/cloudflare` adapter (not Vercel, not the deprecated `@cloudflare/next-on-pages`).

## Commands

```bash
# Dev server (Turbopack)
npm run dev

# Production build (webpack — needed for OpenNext)
npm run build

# Local Cloudflare Worker preview (build with OpenNext, serve on workerd)
npm run preview

# Deploy to Cloudflare
npm run deploy        # build + deploy
npm run upload        # build + upload (no traffic shift)

# Lint
npm run lint

# Regenerate Cloudflare env types after wrangler.jsonc changes
npm run cf-typegen
```

## Architecture

### Stack

- **Next.js 16.1.6** — App Router, React Server Components by default, Client Components for interactive surfaces.
- **React 19.2.3**.
- **Tailwind CSS v4** + `@tailwindcss/typography`.
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres, Auth (Google OAuth + Email OTP), RLS for per-user data.
- **`marked` v17** — markdown rendering with a custom security-restricted renderer.
- **`html-to-image`** — client-side PNG rasterization for the share feature's downloadable card. Dynamically imported only inside the click handler that generates the image (`src/lib/share/generateShareCard.ts`) — never a static top-level import, per the latency-first constraint (see below).
- **Cloudflare Workers** runtime via **`@opennextjs/cloudflare` v1.17.x**. Wrangler v4. `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`.
- **Postmark** (Server token via secret) — transactional welcome emails.

### Source layout

```
src/
├── app/
│   ├── layout.tsx                          # Root
│   ├── page.tsx                            # Landing
│   ├── (auth)/{login,signup,onboarding/language,profile}/page.tsx
│   ├── (app)/
│   │   ├── chat/page.tsx                   # New chat
│   │   ├── chat/[conversationId]/page.tsx  # Existing conversation
│   │   ├── q/[slug]/page.tsx               # SEO answer pages
│   │   └── faq/page.tsx
│   ├── share/[hash]/page.tsx               # ★ Public read-only conversation share (EN)
│   ├── [lang]/share/[hash]/page.tsx        # ★ Public read-only conversation share (ES/FR)
│   ├── sitemap.ts
│   └── api/
│       ├── chat/route.ts                   # ★ SSE proxy to Model API (server-only)
│       ├── welcome-email/route.ts
│       └── auth/callback/route.ts
├── components/
│   ├── chat/
│   │   ├── ChatShell.tsx                   # ★ Orchestration + SSE state machine + persistence
│   │   ├── MessageList.tsx                 # Streaming message list + "Finalizing…" indicator
│   │   ├── MessageBubble.tsx               # Final message render with citation pills; reused as-is on the public share page
│   │   ├── ChatPanel.tsx, SourcesPanel.tsx, Composer.tsx
│   │   ├── ConversationSidebar.tsx, MobileHeader.tsx, SidebarRail.tsx
│   │   ├── LoginModal.tsx, AnonymousBanner.tsx, ShareFeatureBanner.tsx
│   │   ├── ShareModal.tsx                  # ★ Share link/copy + card background+text-shade picker + download
│   │   ├── ShareCardTemplate.tsx           # ★ Off-screen 1200×630 DOM node captured by html-to-image
│   │   └── DragDivider.tsx, WelcomeEmailTrigger.tsx
│   └── share/
│       └── SharePageShell.tsx              # ★ Read-only conversation view + continue/fork button
├── lib/
│   ├── sse/parser.ts                       # ★ SSE event parsing (snake → camel mapping)
│   ├── chat/
│   │   ├── types.ts                        # Message, RagData, StreamingStatus
│   │   └── forkFromShare.ts                # ★ Forks a shared conversation into a new owned one
│   ├── share/
│   │   ├── cardBackgrounds.ts              # ★ Share-card background photo + text-shade config
│   │   └── generateShareCard.ts            # ★ html-to-image wrapper (dynamic import only)
│   ├── markdown/
│   │   ├── render.ts                       # marked + sanitization (no raw HTML)
│   │   ├── citations.ts                    # Citation pills + Evidence label + truncateAfterFirstCitation (share-card excerpt)
│   │   ├── chatPostprocess.ts              # --- dividers, Reader Note normalization
│   │   ├── ragPostprocess.ts               # Strip boilerplate from RAG context
│   │   └── ngramHighlight.ts               # ★ Literal query/passage word-overlap highlighting (Sources panel only)
│   ├── db/
│   │   ├── queries.ts                      # ★ Typed Supabase reads/writes (browser client, RLS-scoped to the caller)
│   │   └── share-queries.ts                # ★ Public share reads — goes through RPCs, never a direct table select on conversation_shares/chat_messages (see "Conversation sharing" below)
│   ├── supabase/{client,server,middleware}.ts
│   ├── security/{rateLimit,requestHeaders}.ts
│   ├── email/sendWelcomeEmail.ts
│   └── utils/{ids,time,answerDedup}.ts
└── styles/globals.css
```

### Auth model

- Supabase Auth (Google OAuth + Email OTP). Sessions are cookie-based via `@supabase/ssr`.
- Browser client: `lib/supabase/client.ts` (anon key from `NEXT_PUBLIC_*`).
- Server client: `lib/supabase/server.ts` (reads session cookies).
- Session refresh middleware: `src/middleware.ts`.
- **Anonymous chat is allowed** for the first few turns; persistence is gated on `userId !== null`. Anonymous users hit a per-IP rate-limit at the proxy (10 req/min).

### Supabase schema (chat-relevant tables)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Per-user metadata | `user_id` (PK→auth.users), `display_name`, `language`, `welcome_email_sent_at` |
| `conversations` | One row per chat thread | `id` (uuid PK), `user_id`, `title`, `conversation_summary`, `created_at`, `updated_at` |
| `chat_messages` | Per-message rows (markdown content) | `id` PK, `conversation_id`, `user_id`, `role` (`user`\|`assistant`), `content`, `created_at` |
| `conversation_rag` | Latest RAG context for a thread (1:1) | `conversation_id` PK, `rag_context`, `retrieval_query`, `retrieval_metadata` (jsonb), `updated_at` |
| `conversation_shares` | Public read-only share links for a conversation | `id` PK, `share_hash` (unique, unguessable), `conversation_id`, `owner_id`, `language`, `cutoff_created_at`, `title_snapshot`, `rag_context_snapshot`, `retrieval_query_snapshot`, `retrieval_metadata_snapshot`, `conversation_summary_snapshot`, `created_at` |
| `seo_cache` | Public Q/A pages | `slug` PK, `question`, `answer_markdown`, `rag_context`, etc. |
| `sermon_metadata` | Pre-seeded sermon titles by `date_id` | `date_id` PK, `title`, `language` |
| `intro_messages` | Email templates | `id`, `language`, `subject`, `body_markdown` |

RLS is enforced everywhere: users see only their own conversations/messages. Migrations live under `supabase/migrations/`.

## Chat flow end-to-end

This is the load-bearing flow. Touch with care.

### 1. User submits a message

`Composer` → `ChatShell.handleSendMessage(content)`:
- If anonymous and there's already a user message in this thread, open `LoginModal` and stop.
- Build the request body:
  ```ts
  {
    conversation_id: conversationId,
    query: content,
    user_language: "en",
    conversation_summary?: prior summary (follow-ups only),
    history_window?: messages.map(m => ({ role, content })),
  }
  ```
- Append the user message to local state immediately.
- Set `streamingStatus = "connecting"`, clear `streamBuffer` / `ragData` / `error`.
- Logged-in users: fire-and-forget `saveMessage()` for the user message (creating the `conversations` row first if needed). The promise is parked on `dbReadyRef` so the assistant write later waits for it.

### 2. POST to the same-origin proxy

```ts
fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
  signal: controller.signal,
})
```

`src/app/api/chat/route.ts` runs on Cloudflare Workers and:
1. Parses & size-validates the body (conversation_id ≤128, query ≤4000, history ≤12 messages of ≤4000 each).
2. For anonymous users, applies a 10-req/min per-IP fixed-window rate-limit (`lib/security/rateLimit.ts`).
3. Proxies to `${MODEL_API_BASE_URL}/api/chat` with `Authorization: Bearer ${CHAT_API_BEARER_KEY}` injected from a Workers secret.
4. Streams the upstream body back as SSE with headers `Content-Type: text/event-stream`, `Cache-Control: no-store, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` (an explicit pull-based ReadableStream guarantees per-chunk forwarding).

### 3. Browser parses the SSE stream

`src/lib/sse/parser.ts: processSSEStream(reader, onEvent, signal)` walks the byte stream line-by-line, normalizes `\r\n`, accumulates multi-line `data:` fields, flushes on blank lines.

`parseChatEvent` maps the wire format (snake_case) to the typed `ChatSSEEvent` (camelCase):

| Wire event | Parsed shape |
|---|---|
| `start` | `{ type: "start", conversationId }` |
| `rag` | `{ type: "rag", retrievalQuery, ragContext, retrieval }` |
| `delta` | `{ type: "delta", text }` |
| `final` | `{ type: "final", mode, answer, externalInfo, conversationSummary, querySummary }` |
| `done` | `{ type: "done", ok }` |
| `error` | `{ type: "error", mode, answer }` |

Unknown event types return `null` and are silently skipped — **adding new events on the API side is a non-breaking change**.

### 4. State machine (`ChatShell`)

`StreamingStatus` ∈ `idle | connecting | rag_received | streaming | complete | error`.

| Event | Status | Side effect |
|---|---|---|
| (POST sent) | `connecting` | Spinner shown |
| `start` | (no change) | Capture `conversation_id` |
| `rag` | `rag_received` | Populate `ragData` for `SourcesPanel`. **`MessageList`'s "Finalizing response…" indicator renders only while `status === "rag_received"`** (`MessageList.tsx` ~L36–43). On desktop, switch to Sources tab; on mobile, set `sourcesReady=true` (no forced switch). |
| `delta` (first) | `streaming` | Append text to `streamBuffer`; `StreamingText` renders markdown live with a blinking caret. On mobile, set `chatReady=true`. |
| `delta` (subsequent) | (no change) | Append to buffer; re-render |
| `final` | `complete` | **Replace streamed buffer with `final.answer`** (the deltas were display-only). Append assistant message to `messages`. Trigger persistence (see below). |
| `done` | `idle` | Cleanup |
| `error` | `error` | Banner; clear buffer; do NOT overwrite `conversation_summary` |

### 5. Persistence (logged-in users only, fired on `final`)

`ChatShell` awaits the user-message DB promise (`dbReadyRef`) then runs `Promise.all([...])`:

- **`saveMessage(id, conversation_id, user_id, "assistant", final.answer)`** → `chat_messages`. Content is the canonical markdown answer (no "Answer:" prefix — `stripAnswerPrefix` is applied at render time, not at write time).
- **`upsertRag(conversation_id, postprocessRag(final.ragContext is from rag event, not final), retrieval_query, retrieval_metadata)`** → `conversation_rag` (UPSERT on `conversation_id`). The `ragContext` is preprocessed via `postprocessRag()` to remove boilerplate before storage.
- **`updateConversationAfterTurn(conversation_id, final.conversationSummary)`** → `conversations.conversation_summary`. **This is the source of truth for memory handoff to the next turn** — the next request reads it back and sends it as `conversation_summary`. If `conversationSummary` is null, `updated_at` is bumped to keep the conversation at the top of the sidebar.
- **`renameConversation(conversation_id, final.querySummary)`** — only when this is a brand-new conversation AND `querySummary` is truthy (auto-title for first turn). All other turns return `querySummary: null` and this is skipped.

### 6. Markdown rendering pipeline

Rendering is split into a "live streaming" path and a "final/historical" path because citation-pill DOM rewriting is too expensive to run on every token.

**Streaming** (`MessageList.tsx → StreamingText`): on every delta, recompute `renderMarkdown(postprocessChatResponse(stripParagraphLetterSuffixes(streamBuffer)))`. **No `applyCitations()`** at this stage. Append a blinking caret span.

**Final / historical** (`MessageBubble.tsx`): same pipeline plus `stripAnswerPrefix` and `applyCitations(html)`. Citation pills are matched by regex (e.g. `[TITLE — 65-1128M: ¶12–¶14]`) and wrapped in `<span class="citation-pill">…</span>`; "Evidence:" is wrapped in `<span class="evidence-label">Evidence</span>` and adjacent pills get a separator span for mobile reflow.

**Security guarantees in `lib/markdown/render.ts`**:
- Custom marked renderer drops all raw HTML (`html() => ""`).
- Links are restricted to `http(s)://` schemes; everything else renders as plain text.
- All anchors get `target="_blank" rel="noopener noreferrer"`.
- This means: **the API must not rely on emitting raw `<div>`, `<table>`, `<script>`, or unsafe URLs** — they will be silently stripped.

`chatPostprocess.ts` adds visual structure (dividers above `Quotes` / `References` / `Unverified Information`, normalizes Reader-Note headings, downsizes them). `ragPostprocess.ts` strips repeated sermon-title/copyright/contact boilerplate from the retrieved chunks before they're shown in `SourcesPanel`.

## Wire-format invariants — what breaks if the API changes them

The `parser.ts` switch and `ChatShell` state machine hard-code event names and field names. Treat these as the public contract between the two repos.

1. **Event names**: `start`, `rag`, `delta`, `final`, `done`, `error`. Renaming any of them silently drops the event.
2. **Field names** (snake_case on the wire):
   - `start.conversation_id`
   - `rag.retrieval_query`, `rag.rag_context`, `rag.retrieval`
   - `delta.text`
   - `final.mode`, `final.answer`, `final.external_info`, `final.conversation_summary`, `final.query_summary`
   - `done.ok`; `error.mode`, `error.answer`
3. **Ordering**: `start → rag? → delta* → final → done` (or `error → done`). `rag` must precede the first `delta` for the placeholder UX to work.
4. **Per-chunk delta cadence**: deltas must arrive as the model produces them. If the API buffers all deltas and flushes them at the end, the user sees "Finalizing response…" too long and then the answer renders all-at-once. (See the API repo's MODE B note.)
5. **`final.answer` is canonical** and overwrites the streamed buffer; it must be present and non-empty on success.
6. **Markdown only** — no raw HTML, no non-`http(s)` URLs (they're stripped client-side).
7. **`final.conversation_summary`** must be returned for memory continuity; if it's chronically null, follow-up retrieval quality degrades.

### Safe (additive) API changes

- Adding new event types — parser ignores unknown events.
- Adding new fields on existing events — parser uses optional chaining.
- Adding new values for `final.mode` — unknown modes fall through to "answer" treatment.

### Coordinated changes

If you change a wire-format invariant on the API side, you must also patch (in one logical change set):
- `src/lib/sse/parser.ts` (event/field mapping + types)
- `src/components/chat/ChatShell.tsx` (state machine, persistence)
- `src/lib/db/queries.ts` (if persisted shapes change)
- `src/lib/chat/types.ts` (if union types change)
- `api_contract.md` (the source of truth)
- `CLAUDE.md` here and on the API side

## Conversation sharing

Lets a user turn a saved conversation into a public, read-only `/share/[hash]` (+ `/[lang]/share/[hash]`) link, and generate a downloadable PNG card (question + answer excerpt + citation) for posting elsewhere. SEO `/q/[slug]` pages get a lighter-weight variant that shares the page's own canonical URL directly, with no database row at all (the page is already public and permanent).

### Data model and the security model behind it

`conversation_shares` pins `title_snapshot`, `conversation_summary_snapshot`, `rag_context_snapshot`, `retrieval_query_snapshot`, `retrieval_metadata_snapshot`, and `cutoff_created_at` at share-creation time. **The public share path never reads the live `conversations` row** — title/summary/RAG context for a share always come from these pinned snapshot columns, never a live join. This is deliberate: `conversations.conversation_summary` is rewritten on every turn, so a live read would leak content from turns created *after* the share's cutoff even though `chat_messages` itself stays properly cutoff-gated.

Both `conversation_shares` and the public-share path onto `chat_messages` are read **only through `security definer` RPC functions that take the share hash as an argument** — never a direct `.from(table).select()`:

- `get_conversation_share(p_share_hash text) returns conversation_shares` — the only way to read a share row. Direct table `select` is revoked from `anon`/`authenticated` (`revoke select on conversation_shares from anon, authenticated`), so a bare `select *` from the anon key returns "permission denied" — there is no query shape that enumerates every share in the table, only exact-hash lookup.
- `get_shared_messages(p_share_hash text) returns setof chat_messages` — the only way to read a shared conversation's messages. **This one matters more than it looks**: `chat_messages` retains the project-wide default `SELECT` grant for `anon`/`authenticated` (unlike `conversation_shares`, which had it explicitly revoked), so a naive RLS policy of the shape `using (exists (select 1 from conversation_shares where conversation_id = chat_messages.conversation_id and ...))` — gating only on "does some share exist for this conversation" — would let anyone holding the public anon key bulk-read every shared conversation's message content with no hash at all. This was found and fixed post-implementation (migration `008_fix_chat_messages_share_leak.sql`); if you ever touch `chat_messages` RLS, preserve the property that shared-message access requires presenting the exact `share_hash`, not just "this conversation happens to be shared by someone."

Both RPCs are `security definer` with `set search_path = public` (required — an unpinned `search_path` on a security-definer function is its own vulnerability class) and `grant execute ... to anon, authenticated`.

`src/lib/db/share-queries.ts` wraps both RPCs for client/server code; never bypass it with a direct `.from("conversation_shares")` or `.from("chat_messages")` call on the public read path.

### Continue / fork flow (`src/lib/chat/forkFromShare.ts`)

- **Owner** clicking their own share's continue action routes straight to `/chat/[conversation_id]` — no fork, no new row.
- **Anonymous visitor**: `pending_share_hash` is stashed in `localStorage`, `LoginModal` opens; after auth completes and the user lands back on `/chat`, `ChatShell`'s init effect picks up that key (mutually exclusive with the analogous `pending_seo_slug` SEO-follow-up handoff) and forks.
- **Logged-in, non-owner**: `forkConversationFromShare(shareHash, newOwnerId)` copies the visible messages into a **new** `conversations`/`chat_messages` row set owned by the visitor (via the normal RLS-scoped `queries.ts` writes — `newOwnerId` must always be the caller's own id, never `share.owner_id`), seeds `conversation_rag`/`conversation_summary` from the share's pinned snapshots, and redirects to the new conversation. Messages are copied via a **sequential** loop (not `Promise.all`) so each row's server-assigned `created_at` stays monotonic.

### Card generation

`ShareModal` renders a live-scaled preview of `ShareCardTemplate` and rasterizes the full-size node via `html-to-image` on click (`src/lib/share/generateShareCard.ts` — dynamic-import only, see Stack above; `renderCardToPng` takes the target width/height as a parameter — it must match `CARD_DIMENSIONS[format]`, or the capture silently clips to the wrong crop). Two formats: `landscape` (1200×630, Facebook/OG link-preview convention) and `portrait` (1080×1920, WhatsApp/Instagram Story convention) — both share the same three background tile patterns via `background-size: cover`, no separate portrait assets needed. Background is one of three photos + a light/dark text-shade toggle (`src/lib/share/cardBackgrounds.ts`).

Every card carries a bottom-left corner brand mark (`logo.png` icon + "Branham Sermons Assistant", matching the header's `BrandLogo.tsx` lockup) — plain text, no arrow, no URL, no link color; it's a logo, not a second call-to-action. Uses a plain `<img src="/logo.png">` against the public static path rather than `next/image`'s optimization proxy, so the icon is guaranteed loaded before `html-to-image` captures the DOM (same precedent as `src/app/opengraph-image.tsx`). Rasterized identically wherever the card is generated — Download Image and the live preview share this one template (native Share no longer attaches an image — see "Native share" below).

The card also carries a bottom-right QR code encoding the exact deep link (`readMoreUrl`), with the "Read more →" text shortened to just the bare domain (`new URL(readMoreUrl).host`, not the full URL — too long to read or type by hand). This is what makes the downloadable card self-contained on platforms where it travels with no accompanying clickable link (WhatsApp Status, Instagram, saved and reposted elsewhere). Generated via `qrcode-generator` (`src/lib/share/generateQrMatrix.ts`, dynamic-import-only — same latency-first rule as `html-to-image`, since `ShareModal`/`ShareCardTemplate` are statically imported into `ChatShell`), producing a boolean module matrix rendered as a grid of divs — fixed white/dark contrast regardless of the card's text shade, since scannability needs guaranteed contrast. **No QR code on the Open Graph preview image** (see below) — that image only ever appears alongside an already-tappable link.

**Building the excerpt** (`buildCardAnswerExcerpt` in `src/lib/share/cardExcerpt.ts`) — every card is guaranteed at least one citation:
1. Strip the "Answer:" prefix, truncate right after the answer's first citation (`truncateAfterFirstCitation`) if that result fits within `MAX_EXCERPT_CHARS` (900 — sized from a full survey of every published `/q` answer's actual distance-to-first-citation, in all three languages).
2. If the citation lands too far in to fit, truncate instead at the last paragraph break within budget, falling back to a sentence boundary if no paragraph break falls in range (`truncateAtParagraphOrSentenceBoundary`).
3. If that truncation left the excerpt with no citation, splice in a fallback "Evidence:" block: first choice is the first entry of the answer's **Quotes** section (quote text + citation); if there's no Quotes section (or it doesn't parse), falls back to a bare citation pulled from the **References** section instead.
4. Render through the same `stripAnswerPrefix` → `renderMarkdown` → `applyCitations` pipeline every other assistant-message render path uses.

**Multi-language section headings** — the API emits different heading text per language for the Quotes/References sections the fallback reads (`QUOTES_HEADING_RE`/`REFERENCES_HEADING_RE` in `cardExcerpt.ts`; `citations.ts`'s `findFirstCitation` does the actual bracket-matching once inside a section, deliberately the same strict `[TITLE — DATE_ID: ¶refs]` pattern as `hasCitation`/`truncateAfterFirstCitation` rather than a loose `[...]` match, because a quoted sermon excerpt can itself contain other bracketed content — e.g. `[…]` marking words omitted mid-quote — that a loose match would misidentify as the citation):

| Language | Quotes heading | References heading |
|---|---|---|
| en | Quotes | References |
| es | Citas | Referencias |
| fr | Citations *(space before colon: "### Citations :")* | Références |

**Extending to a new language:** add that language's translations to both heading regexes in `cardExcerpt.ts`, and check `ANSWER_PREFIX` in `src/lib/utils/answerDedup.ts` and `EVIDENCE_PREFIX_RE` in `citations.ts` cover its "Answer:"/"Evidence:" translations too — all three are independent per-language word lists that must stay in sync whenever a language is added.

**Native share** (`ShareModal`'s "Share directly" button, below Download Image) is a **pure link-share** — `navigator.share({ title, text, url })`, no file — so the destination app (WhatsApp, iMessage, Telegram, Slack, etc.) renders its own rich, clickable link-preview card from the page's Open Graph metadata (see below), rather than attaching an unclickable picture. This was a deliberate revision from an earlier file-attaching design (`docs/superpowers/specs/2026-07-30-native-share-design.md`): investigating how WhatsApp specifically handles a combined `navigator.share({ files, url, text })` call found that when a file is attached, the destination treats `url`/`text` as a plain caption and never unfurls a separate preview card — a combined share never actually delivers both a picture and a clickable link, only one or the other depending on which surface (chat vs. Status) the user picks (see `docs/superpowers/specs/2026-08-03-share-card-qr-and-og-preview-design.md`). Only renders when `navigator.share` exists (mobile Safari/Chrome, and some desktop browsers — text/url sharing is supported more broadly than file-sharing, so this button appears in more places than the old file-attaching version did). No pre-generation/rasterization needed at all now — the button is instant. `AbortError` (user backed out of the share sheet) is a silent no-op, not an error.

### Dynamic Open Graph preview images

`/share/[hash]`, `/[lang]/share/[hash]`, `/q/[slug]`, and `/[lang]/q/[slug]` each have their own `opengraph-image.tsx` (Next.js's dynamic-segment special-file convention, rendered via `next/og`'s `ImageResponse`/Satori) — a per-page title + plain-text excerpt preview, replacing the single generic static `src/app/opengraph-image.tsx` that used to apply to every URL. This is what actually renders when "Share directly" (above) or any plain copy-link/paste-URL sharing happens.

Shared rendering logic lives in `src/lib/share/renderOgImage.tsx` — plain Satori-compatible JSX (inline styles only, same discipline `ShareCardTemplate.tsx` already follows: flexbox + absolute positioning + explicit pixel values, no Tailwind classes, no `dangerouslySetInnerHTML`). Each of the 4 route files just fetches its own data (`fetchShareByHash`/`fetchSharedMessages`, or `fetchSeoPage`) and calls it. Falls back to generic branding content (never a 500) when the share/slug isn't found.

The plain-text excerpt comes from `buildOgExcerptText()` in `cardExcerpt.ts` — shares `buildCardAnswerExcerpt`'s truncation/fallback-evidence logic (both now call an internal `buildExcerptWithEvidence` helper) but skips the `renderMarkdown`/`applyCitations` HTML step Satori can't render, stripping markdown syntax instead and leaving citation brackets as plain visible text.

**Important:** `q/[slug]/page.tsx` and `[lang]/q/[slug]/page.tsx`'s `generateMetadata` must NOT set an explicit `openGraph.images`/`twitter.images` — an explicit value there silently overrides Next's automatic file-convention detection of `opengraph-image.tsx` in the same route segment. (`share/[hash]/page.tsx` never set this explicitly, so no equivalent change was needed there.) The JSON-LD `image` field on the `/q/` pages is unaffected by this (JSON-LD isn't part of Next's Metadata API) and is set explicitly to the per-slug image URL (`${canonicalUrl}/opengraph-image`).

### Deletion semantics

`conversation_shares.conversation_id` has `on delete cascade` against `conversations` — deleting the source conversation cascades away every share row pointing at it, and the old links 404 immediately (the RPC lookups return no row).

## Passage n-gram highlighting

`src/lib/markdown/ngramHighlight.ts` (`applyNgramHighlights(html, query)`) highlights literal, contiguous word-overlap (3+ consecutive words, same order) between the retrieval query and each retrieved passage, in the Sources panel only — never in the chat answer panel, which already has its own citation-pill styling. Purely literal matching (NFKD diacritic-insensitive, lowercase, punctuation-agnostic via tokenization) — no stemming or semantic scoring, so many relevant passages will show no highlight at all when they were retrieved by dense/semantic search rather than keyword overlap. That's expected.

It's a post-processing pass over already-rendered HTML (same safety argument as `citations.ts`: the HTML comes only from our own `renderMarkdown`, never arbitrary external HTML), wired into the two independent places passage HTML is rendered:

- **Chat** (`SourcesPanel.tsx`): `applyNgramHighlights(renderMarkdown(postprocessRag(ragData.ragContext)), ragData.retrievalQuery)`.
- **SEO pages** (`SeoShell.tsx`): same shape, keyed on `SeoCacheRow.robust_query` (the query actually used to produce that page's cached `rag_context`) rather than the display `question`.

Note these two call sites are genuinely independent — `SeoShell.tsx` does not render through `SourcesPanel`, despite what an earlier version of this feature's design doc assumed. If either passage-rendering path changes, check whether the other needs the same change.

## Deployment (Cloudflare Workers via OpenNext)

`@opennextjs/cloudflare` builds the Next app into a single Worker bundle and writes assets to `.open-next/`. `wrangler.jsonc` points `main` at `.open-next/worker.js`.

```bash
# Standard build + deploy:
npm run deploy

# Local preview (workerd, with bindings):
npm run preview

# Build + upload but don't shift traffic:
npm run upload
```

Wrangler config (`wrangler.jsonc`):
- `name: "branham-web-app"`, `compatibility_date: "2025-03-01"`
- `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`
- `assets.directory: ".open-next/assets"`, binding `ASSETS`
- `services.WORKER_SELF_REFERENCE → branham-web-app` (used for internal subrequests)
- Routes: `branhamsermons.ai/*` and `www.branhamsermons.ai/*` (zone `branhamsermons.ai`)

### Environment variables / secrets

| Name | Where | Purpose |
|---|---|---|
| `MODEL_API_BASE_URL` | wrangler vars / `.dev.vars` | Cloud Run URL of the Branham LLM API |
| `CHAT_API_BEARER_KEY` | **secret** (`wrangler secret put`) | Bearer for the API proxy. Server-only — never `NEXT_PUBLIC_*`. |
| `NEXT_PUBLIC_SUPABASE_URL` | wrangler vars | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | wrangler vars | Supabase anon key (RLS-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Server-side admin (welcome email trigger, cron tasks) |
| `POSTMARK_SERVER_TOKEN` | **secret** | Postmark API key |
| `POSTMARK_FROM_EMAIL` | wrangler vars | Sender address |

Set secrets:
```bash
wrangler secret put CHAT_API_BEARER_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put POSTMARK_SERVER_TOKEN
```

After editing `wrangler.jsonc`, regenerate types: `npm run cf-typegen`.

### Build / runtime notes

- **No `export const runtime = 'edge'`** on individual routes — OpenNext does not support per-route runtime declarations; the whole app is one Worker.
- The `.open-next/` directory is generated; never commit by hand.
- The proxy route's response-stream construction (`route.ts`) is intentionally a manual `ReadableStream`; do not "simplify" it to `return new Response(upstream.body)` — pull-based forwarding is what guarantees the per-chunk SSE cadence the FE depends on.

## Reference

- Full design: `.cursor/rules/design_spec.md`
- SSE contract: `api_contract.md`
- Backend (the API this app calls): `/Users/emeraldhenry/Branham-LLM-AI-API/CLAUDE.md`
