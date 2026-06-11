# Frontend Integration Contract: `POST /api/chat`

This document is the frontend instruction guide /for request payloads and SSE response handling.

## Endpoint

- Method: `POST`
- Path: `/api/chat`
- Response type: `text/event-stream` (SSE)

## Required Auth Header

- Every request must include:
  - `Authorization: Bearer <CHAT_API_BEARER_KEY>`
- Backend validates bearer token before processing body.
- `conversation_id` remains in request JSON body (not in headers).
- Current integration key (as configured):
  - `CHAT_API_BEARER_KEY=b6766b2e-9a26-4342-9bef-5da4ad67e51c`
- Recommended:
  - keep this key in FE environment/config and inject into the header at request time
  - do not hardcode in UI source files

## Request Body

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "query": "What did Brother Branham teach about faith?",
  "user_language": "en",
  "conversation_summary": "User asked about faith from Branham sermons and references in Hebrews 11 were discussed.",
  "history_window": [
    { "role": "user", "content": "What is faith?" },
    { "role": "assistant", "content": "Faith is the substance..." },
    { "role": "user", "content": "Can you explain from Branham sermons?" }
  ]
}
```

## Request Field Rules

- `conversation_id` (required, string)
  - Stable ID for one conversation.[ask-confirmation.d.ts](node_modules/%40opennextjs/cloudflare/dist/cli/utils/ask-confirmation.d.ts)
  - Keep the same value across turns in the same chat.
  - Backward-compatible alias accepted by backend: `session_id`.

- `query` (required, string)
  - Current user turn.
  - Must be non-empty.

- `user_language` (optional, string)
  - ISO/BCP-47 language hint (`en`, `es`, `fr`, etc.).

- `conversation_summary` (optional, string)
  - Compact memory handoff from previous turn.
  - Used to improve retrieval quality.

- `history_window` (optional, array)
  - Each item:
    - `role`: `"user"` or `"assistant"`
    - `content`: string
  - Order: oldest to newest.
  - Latest turn must be last.

## Backend Input Composition

- Retrieval query: `query` + `conversation_summary` (if provided), otherwise `query` alone.
- LLM context includes:
  - system prompt
  - current query
  - optional recent `history_window`
  - RAG context
  - optional tool outputs (if tools are called)

## SSE Response Events

Frontend must parse events in this order pattern:

1. `start`
2. one or more `delta`
3. `final`
4. `done`

Error path may include:
- `error`
- `done`

### `start` event

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `delta` event

```json
{
  "text": "partial streamed text chunk"
}
```

- Append each `delta.text` to live UI output.
- `delta` is used for both normal answers and refusal text.

### `rag` event (NEW: retrieval-first evidence)

This event is emitted as soon as retrieval completes and the UI-formatted evidence is ready.

Important: `rag` is intentionally sent **before** the server begins streaming model tokens so the frontend can display evidence immediately and show a “finalizing response” / “thinking” state while waiting for the first `delta`.

```json
{
  "retrieval_query": "What did Brother Branham teach about faith?\n\nConversation summary:\n...",
  "rag_context": "## Retrieved sermon context\n### 1. SERMON TITLE — YYYY-MM-DD\n- Retrieved chunks: N\n\nChunks:\n- ¶X–¶Y\n...",
  "retrieval": {
    "should_refuse": false,
    "refuse_reason": null,
    "bm25_hit_count": 25,
    "dense_hit_count": 25,
    "fused_hit_count": 40,
    "sermon_count": 8,
    "total_chunks": 64,
    "reranker_triggered": false,
    "signals": {
      "dense_score_std": 0.021,
      "dense_top_score": 0.77,
      "bm25_dense_overlap": 2,
      "quote_intent": false
    }
  }
}
```

Frontend handling:
- Render `rag_context` immediately as the “Evidence / Retrieved context” panel.
- Cache `rag_context` locally per-turn (and optionally persist it in DB) so the UI can show what evidence the answer was based on.
- This event is **not** emitted for:
  - the **English-only language gate** path (non-English queries), and
  - **early retrieval refusals** (off-topic / below thresholds), where the server streams only the refusal.

### `final` event

```json
{
  "mode": "answer",
  "answer": "full final text",
  "external_info": {
    "disclaimer": "Unverified external search results.",
    "sources": ["https://..."]
  },
  "conversation_summary": "Compact summary for next-turn memory."
}
```

Fields:
- `mode`: `"answer" | "refusal" | "error"`
- `answer`: final authoritative response text
- `external_info`:
  - `null` unless external web tool was used
  - when present, show disclaimer and sources clearly
- `conversation_summary`:
  - non-stream metadata
  - use as FE memory handoff for next request
  - expected behavior:
    - present for normal answer flow
    - present for LLM-side refusal flow when summary generation succeeds
    - `null` for early retrieval refusal (fail-fast before generation)
    - may be `null` on internal failures

### `error` event

```json
{
  "mode": "error",
  "answer": "Request could not be processed."
}
```

### `done` event

```json
{
  "ok": true
}
```

## Frontend Handling Rules by `mode`

- `answer`
  - Render final answer.
  - Save `conversation_summary` for next turn.
  - If `external_info` exists, show unverified notice and sources.

- `refusal`
  - Render refusal text normally.
  - Still persist returned `conversation_summary` when present.

- `error`
  - Show generic error UI state.
  - Do not overwrite existing conversation summary with null.

## UI / UX Recommendations (Multi-turn)

### Large screens (desktop/tablet)
- Use a split layout:
  - **Evidence panel** (top or left): show latest `rag_context` plus an expandable history of previous turns’ evidence.
  - **Chat panel** (bottom or right): stream `delta` into the assistant message for the current turn.
- Keep the chat input anchored; do not “switch modes” per turn.

### Small screens (phones)
- Keep **chat as the primary full-height view** to avoid layout bouncing per turn.
- Provide an **Evidence drawer** (collapsible bottom-sheet or side drawer):
  - Default collapsed.
  - Opens to show the latest `rag_context`.
  - Include a “View evidence” button per assistant turn to open the drawer to that turn’s evidence.
- This preserves multi-turn flow without toggling between two modes on every turn.

## FE Validation Checklist

- Always send `conversation_id` and `query`.
- Always send `Authorization: Bearer <CHAT_API_BEARER_KEY>`.
- Send `history_window` oldest -> newest.
- Keep roles restricted to `user` / `assistant`.
- Treat `final.answer` as source of truth (not concatenated deltas alone).
- Store `final.conversation_summary` for the next request when provided.
- Handle `external_info` as unverified external data.


## Basic Curl:
curl -N -X POST https://api.branhamsermons.ai/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer b6766b2e-9a26-4342-9bef-5da4ad67e51c" \
  -d '{"conversation_id": "test-001", "query": "Who is William Branham?"}'

---

# Frontend Integration Contract: `POST /api/reference` (Citation Tooltip)

This endpoint powers the **reference tooltip** feature: when a user clicks a sermon
citation pill in an assistant message (e.g. `[THE SEVENTH SEAL — 63-0324E: ¶386–¶388]`),
the FE calls this endpoint and shows a small Strong's-Concordance-style popover with the
referenced sermon paragraphs **plus one paragraph above and one below** for context.

It is a plain JSON request/response (NOT SSE). No LLM is involved — it is a fast
read-only lookup against the sermon paragraph store.

## Endpoint

- Method: `POST`
- Path: `/api/reference`
- Response type: `application/json`
- Auth: same `Authorization: Bearer <CHAT_API_BEARER_KEY>` as `/api/chat`.
  Inject server-side in the FE proxy route (mirror `src/app/api/chat/route.ts`);
  never expose the bearer key to the client bundle.

## Request Body

```json
{
  "date_id": "63-0324E",
  "paragraph_start": 386,
  "paragraph_end": 388,
  "title": "THE SEVENTH SEAL"
}
```

### Request Field Rules

| Field             | Type            | Required | Notes |
|-------------------|-----------------|----------|-------|
| `date_id`         | string          | yes      | The sermon identifier from the pill (e.g. `63-0324E`). Accepts an exact id, a day-prefix (`63-1201` → resolves M/E), or falls back to `title` if it does not resolve. |
| `paragraph_start` | integer\|string | yes      | First cited paragraph. Suffix styles like `"386a"` are accepted and normalized to `386`. |
| `paragraph_end`   | integer\|string | no       | Last cited paragraph. **Omit for a single-paragraph reference** — it defaults to `paragraph_start`. |
| `title`           | string          | no       | Sermon title from the pill; used ONLY as a resolution fallback when `date_id` does not resolve. Never trusted over a valid `date_id`. |

- **Multi-range pills** (e.g. `¶157–¶163, ¶164–¶171`): send the overall span —
  `paragraph_start: 157`, `paragraph_end: 171`. The endpoint returns that whole span ±1.
- **Bible references** (`Evidence: John 3:16`) are NOT sermon pills and have no
  `date_id`; do not make them clickable / do not call this endpoint for them.

## Response Body (200)

```json
{
  "ok": true,
  "date_id": "63-0324E",
  "title": "THE SEVENTH SEAL",
  "requested": { "paragraph_start": 386, "paragraph_end": 388 },
  "returned":  { "paragraph_start": 385, "paragraph_end": 389 },
  "paragraphs": [
    { "paragraph_no": 385, "sub_id": "",  "text": "...", "is_context": true  },
    { "paragraph_no": 386, "sub_id": "",  "text": "...", "is_context": false },
    { "paragraph_no": 387, "sub_id": "",  "text": "...", "is_context": false },
    { "paragraph_no": 388, "sub_id": "",  "text": "...", "is_context": false },
    { "paragraph_no": 389, "sub_id": "",  "text": "...", "is_context": true  }
  ]
}
```

- `requested` — the cited range echoed back (after normalization).
- `returned` — the actual span returned, i.e. `requested` expanded by ±1 and **clamped
  to sermon bounds** (so the first paragraph of a sermon has no paragraph above it).
- `paragraphs` — ordered by `paragraph_no` ascending. A paragraph may be split into
  sub-parts (`sub_id` like `a`/`b`); when present, render them in array order as one
  paragraph. Most paragraphs have `sub_id: ""`.
- `is_context: true` marks the ±1 padding paragraphs (one above, one below). The cited
  paragraphs have `is_context: false`. **Use this flag to visually de-emphasize the
  context paragraphs** (dimmed / smaller) so the user's eye lands on the actual citation.

## Error Responses

| Status | Body | When |
|--------|------|------|
| 401    | `{ "detail": "Invalid bearer token." }` | Missing/wrong bearer. |
| 422    | `{ "detail": [...] }` | Malformed body (missing `date_id` or `paragraph_start`). FastAPI validation shape. |
| 404    | `{ "ok": false, "error": "sermon_not_found", "date_id": "..." }` | `date_id` (and `title` fallback) could not be resolved to a sermon. |
| 200 + empty | `{ "ok": true, ..., "paragraphs": [] }` | Sermon resolved but the requested paragraph range yielded no rows (out-of-range). FE should show a "passage not available" empty state, not an error banner. |

## Curl

```bash
curl -sS -X POST https://api.branhamsermons.ai/api/reference \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer b6766b2e-9a26-4342-9bef-5da4ad67e51c" \
  -d '{"date_id":"63-0324E","paragraph_start":386,"paragraph_end":388}'
```

---

## Frontend Render & Integration Guide

This is the FE-side work (in this repo) once the endpoint is live. The backend author
filled this in with the integration points already present in the codebase.

### 1. Make citation pills clickable

Pills are produced in `src/lib/markdown/citations.ts` by `applyCitations()` →
`makePill()`, currently:

```html
<span class="citation-pill">[THE SEVENTH SEAL — 63-0324E: ¶386–¶388]</span>
```

Parse the pill's inner text at pill-creation time and embed structured `data-*`
attributes plus an affordance class. Suggested output:

```html
<span
  class="citation-pill citation-pill--clickable"
  role="button"
  tabindex="0"
  data-date-id="63-0324E"
  data-title="THE SEVENTH SEAL"
  data-para-start="386"
  data-para-end="388"
>[THE SEVENTH SEAL — 63-0324E: ¶386–¶388]</span>
```

Parsing notes (the pill text is the only source — there is no hidden ID):
- The bracket text is `TITLE — DATE_ID: ¶START–¶END` (em/en/hyphen dash variants).
  `DATE_ID` matches `\d{2}-\d{4}[A-Z]?\d?`. Reuse/extend the existing `CITATION_RE`.
- For a multi-range pill (`¶157–¶163, ¶164–¶171`), set `data-para-start` to the first
  number (`157`) and `data-para-end` to the last number (`171`).
- Strip `¶` and any letter suffix from the numbers before putting them in `data-*`
  (`¶386a` → `386`).
- Only sermon pills get `--clickable`. Bible-ref text never becomes a clickable pill.

### 2. Affordance (clickable styling)

`.citation-pill--clickable` should read as tappable without being noisy:
`cursor: pointer`, a subtle tinted background / underline-on-hover, and a focus ring
(`:focus-visible`) for keyboard users. Keep the existing pill chrome; just add the
"interactive" layer. Honor `prefers-reduced-motion` for any hover transition.

### 3. Click handling (event delegation)

Assistant HTML is injected via `dangerouslySetInnerHTML` in `MessageBubble.tsx`, so you
cannot attach React `onClick` to individual pills. Use **event delegation**: one listener
on the message container (or a shared `ChatShell` handler) that:

1. Finds the nearest `.citation-pill--clickable` ancestor of the event target.
2. Reads `data-date-id`, `data-title`, `data-para-start`, `data-para-end`.
3. Opens the popover anchored to that pill element and fires the fetch.
4. Also trigger on `Enter`/`Space` keydown for `role="button"` pills (a11y).

### 4. Fetch via a proxy route

Add `src/app/api/reference/route.ts` mirroring `src/app/api/chat/route.ts`:
- Reads `MODEL_API_BASE_URL` + `CHAT_API_BEARER_KEY` from env (server-side).
- Validates a small body (`date_id` string ≤ 32 chars; `paragraph_start`/`_end`
  positive ints; optional `title` ≤ 200 chars).
- `POST`s to `${MODEL_API_BASE_URL}/api/reference` with the `Authorization` header.
- Applies the same anon IP rate-limit pattern as the chat proxy (clicks are cheap, but
  keep parity). Returns the upstream JSON unchanged.

### 5. Popover component (Strong's-Concordance style)

A focused, dismissible overlay — NOT a full-screen modal. Big enough to read comfortably
on phone and laptop, anchored near the clicked pill.

**Header:** sermon title + `date_id` and the cited range (e.g. "THE SEVENTH SEAL ·
63-0324E · ¶386–¶388"), with a close (`X`) button in the top-right.

**Body:** the `paragraphs` array, each prefixed with its `¶<paragraph_no>`. Render
`is_context: true` paragraphs **dimmed/de-emphasized** (e.g. lower opacity or muted color,
slightly smaller) and `is_context: false` paragraphs at full emphasis. Scroll inside the
popover body if content overflows the max height.

**States:**
- *Loading:* skeleton or spinner while the fetch is in flight (open the popover
  immediately on click; don't wait for the response to appear).
- *Empty* (`paragraphs: []`): "This passage isn't available." message.
- *Error* (non-200 / network): "Couldn't load this reference. Try again." with a retry.

**Dismissal (all three):**
- Click/tap the `X` button.
- Click/tap outside the popover (backdrop or outside-click listener).
- Press `Esc`.
On close, return focus to the pill that opened it.

**Sizing / placement:**
- Desktop/tablet: anchored popover near the pill (flip/shift to stay on-screen), capped
  width (~420–520px) and max-height (~60vh) with internal scroll.
- Phone: a bottom sheet or near-full-width centered card (e.g. ~92vw, max-height ~70vh)
  is easier to read than a tiny anchored bubble. Backdrop tap closes it.

**Accessibility:** `role="dialog"` + `aria-modal`, labelled by the header; trap focus
while open; restore focus on close; the `X` button has an `aria-label`.

### 6. Caching (optional, recommended)

Cache responses by `${date_id}:${start}-${end}` for the session so re-clicking the same
pill is instant and avoids a redundant round-trip.

### FE Validation Checklist (reference tooltip)

- Only sermon pills are clickable; Bible refs are not.
- Proxy injects the bearer; key never reaches the client bundle.
- Popover opens immediately with a loading state, then fills.
- Context (±1) paragraphs are visually de-emphasized via `is_context`.
- Dismiss works via `X`, outside-click, and `Esc`; focus returns to the pill.
- Empty (`paragraphs: []`) and error states are handled distinctly.
