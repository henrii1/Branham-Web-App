# FAQ Page Speed Redesign

**Date:** 2026-07-15
**Status:** Approved

## Problem

The `/faq`, `/es/faq`, and `/fr/faq` pages are extremely slow to load. The root cause is `fetchAllPublishedSeoPages`, which fetches all 12 columns from `seo_cache` on every request — including `answer_markdown` and `rag_context`, the two largest text blobs — for every row in the result set. For 34+ questions per language, this pulls megabytes of data that the FAQ list page never displays.

Secondary issue: the accordion expand-to-preview UX shows an unformatted markdown excerpt, which is both a UX problem and the only reason `answer_markdown` was being fetched at all.

## Goals

- FAQ pages load fast on first and subsequent visits
- Users click a question card and navigate directly to the full `/q/[slug]` answer page
- No visual regression — cleaner layout than the current accordion
- No changes to the Q/[slug] answer pages (out of scope)

## Non-Goals

- Adding categories or topic grouping to the FAQ
- Changing the Q/[slug] answer page performance (acceptable as-is)
- Caching per-user profile data (the language-redirect auth check stays as-is)

---

## Data Layer

### New function: `fetchFaqListItems(language: string)`

Location: `src/lib/db/seo-queries.ts`

Selects only `slug, question, meta_description` from `seo_cache`. This replaces the 12-column `fetchAllPublishedSeoPages` call on both FAQ pages.

The existing `fetchAllPublishedSeoPages` is **not modified** — it remains in use on the Q/[slug] pages which need the full row.

```ts
export async function fetchFaqListItems(
  language = "en",
): Promise<Pick<SeoCacheRow, "slug" | "question" | "meta_description">[]>
```

### Caching: `unstable_cache`

Wrap `fetchFaqListItems` with Next.js `unstable_cache`:
- **TTL:** 3600 seconds (1 hour)
- **Cache key tags:** `["faq-list", language]`
- One cache entry per language (3 total: `en`, `es`, `fr`)

This means the first request after a deploy warms the cache; all subsequent requests within the hour pay near-zero DB cost.

### JSON-LD

Both FAQ pages currently generate a `FAQPage` schema with excerpts derived from `answer_markdown`. With the new lean query, the answer text for the schema uses `meta_description` instead (already a short human-readable summary). If `meta_description` is null for a row, **fall back to the question text itself** — this guarantees every item appears in the schema regardless of `meta_description` coverage.

---

## Component

### `FaqGrid` (new, replaces `FaqAccordion`)

Location: `src/components/seo/FaqGrid.tsx`

**Server component** — no `"use client"`, no React state. Each item is a plain Next.js `<Link>`.

**Props:**
```ts
interface FaqGridProps {
  items: { slug: string; question: string }[];
  slugPrefix?: string; // default "/q"
}
```

**Layout:**
- 2-column CSS grid on desktop (`lg:grid-cols-2`)
- 1-column on mobile
- `gap-3` between cards

**Card anatomy:**
- Full card is a `<Link href={slugPrefix/slug}>`
- Question text: `text-sm font-semibold text-foreground lg:text-base`
- Right-arrow icon pinned to bottom-right of the card, zinc-400
- Card border: `border border-zinc-200 dark:border-zinc-800`, rounded-xl
- Hover: `hover:-translate-y-0.5 hover:shadow-md transition-all duration-150`
- No excerpt shown

### `FaqAccordion` (retired from FAQ pages)

`FaqAccordion.tsx` is **not deleted** — it may be reused elsewhere. It is simply no longer imported by the FAQ page files.

---

## Page Changes

### `/faq` — `src/app/faq/page.tsx`

1. Replace `fetchAllPublishedSeoPages()` with `fetchFaqListItems("en")`
2. Replace `<FaqAccordion>` with `<FaqGrid>`
3. Update `faqItems` mapping: only `slug` and `question`
4. Update JSON-LD: use `meta_description` for answer text; omit items where null
5. Remove `getExcerpt` and `stripMarkdownToPlain` helpers

Language-redirect auth check stays unchanged.

### `/[lang]/faq` — `src/app/[lang]/faq/page.tsx`

Same changes, using `fetchFaqListItems(l)` and `<FaqGrid slugPrefix={/${l}/q} />`.

---

---

---

## Chat UI Localization

### Problem

Static UI text in the chat page (welcome card, passages panel, tab labels, composer placeholder, etc.) is always in English, even when the user's language is set to Spanish or French. This is inconsistent with the AI responding in their language.

### Approach

`chatLanguage` state already lives in `ChatShell` and reflects the user's active language. We use it to drive a client-side string lookup — no new DB calls, no server-side changes, no SEO impact (the chat page is not indexed).

### New file: `src/lib/i18n/chatStrings.ts`

A plain TypeScript object with EN/ES/FR translations for all user-visible static strings in the chat UI. Exported as `getChatStrings(lang: string)` returning the correct locale's strings (falls back to `en` for unsupported languages).

**Strings to translate:**

| Key | EN |
|---|---|
| `welcomeDescription` | Ask questions about the sermons… |
| `passagesTitle` | Passages |
| `passagesDescription` | Sermon passages retrieved for your question will appear here… |
| `passagesSectionHeader` | Sermon Passages |
| `switchingTopics` | Switching topics? |
| `startNewChat` | Start a new chat |
| `forMorePassages` | for more relevant passages. |
| `viewPassages` | View passages |
| `backToAnswer` | Back to answer |
| `respondingIn` | Responding in |
| `popularQuestions` | Popular Questions |
| `chatTab` | Chat |
| `passagesTab` | Passages |
| `finalizingResponse` | Finalizing response… |
| `askPlaceholder` | Ask a question… |
| `waitingPlaceholder` | Waiting for response… |

"Branham Sermons Assistant" is a brand name — it stays in English across all locales.

### Passing strings to components

`ChatShell` calls `getChatStrings(chatLanguage)` and passes the result (or individual string props) down to:
- `ChatPanel` — `welcomeDescription`
- `SourcesPanel` — `passagesTitle`, `passagesDescription`, `passagesSectionHeader`
- `Composer` — `askPlaceholder`, `waitingPlaceholder`
- `MessageList` — `finalizingResponse`
- `MobileHeader` (inline in ChatShell) — `chatTab`, `passagesTab`, `popularQuestions`, `viewPassages`, `backToAnswer`
- The "Switching topics?" nudge and the `ChatLanguagePill` label — inline in `ChatShell`

### Timing

The strings switch at the same moment the language pill updates — after `fetchUserLanguage` resolves on auth. The initial render briefly shows English strings before flipping to the user's language. This matches the existing pill behavior and is acceptable given the chat page is dynamic.

### SEO

No impact. `/chat` is not indexed. The FAQ and Q/[slug] pages are unaffected.

---

---

## Chat UI Localization

### Problem

Static UI text in the chat page (welcome card, passages panel, tab labels, composer placeholder, etc.) is always in English, even when the user's language is set to Spanish or French.

### Approach

`chatLanguage` state already lives in `ChatShell` and reflects the user's active language. Client-side string lookup off that state — no new DB calls, no SSR changes, no SEO impact (chat page is not indexed), zero latency cost.

### New file: `src/lib/i18n/chatStrings.ts`

Plain TS object with EN/ES/FR translations for all user-visible static strings. Exported as `getChatStrings(lang: string)` — falls back to `en` for unsupported languages.

**Strings to translate (brand name "Branham Sermons Assistant" stays in English):**

| Key | EN | ES | FR |
|---|---|---|---|
| `welcomeDescription` | Ask questions about the sermons… | Haga preguntas sobre los sermones… | Posez des questions sur les sermons… |
| `passagesTitle` | Passages | Pasajes | Passages |
| `passagesDescription` | Sermon passages retrieved… | Los pasajes de sermones recuperados… | Les passages de sermons récupérés… |
| `passagesSectionHeader` | Sermon Passages | Pasajes de Sermones | Passages de Sermons |
| `switchingTopics` | Switching topics? | ¿Cambiando de tema? | Vous changez de sujet ? |
| `startNewChat` | Start a new chat | Inicie un nuevo chat | Commencer un nouveau chat |
| `forMorePassages` | for more relevant passages. | para pasajes más relevantes. | pour des passages plus pertinents. |
| `viewPassages` | View passages | Ver pasajes | Voir les passages |
| `backToAnswer` | Back to answer | Volver a la respuesta | Retour à la réponse |
| `respondingIn` | Responding in | Respondiendo en | Répondre en |
| `popularQuestions` | Popular Questions | Preguntas populares | Questions populaires |
| `chatTab` | Chat | Chat | Chat |
| `passagesTab` | Passages | Pasajes | Passages |
| `finalizingResponse` | Finalizing response… | Finalizando respuesta… | Finalisation de la réponse… |
| `askPlaceholder` | Ask a question… | Haga una pregunta… | Posez une question… |
| `waitingPlaceholder` | Waiting for response… | Esperando respuesta… | En attente de réponse… |

### Wiring

`ChatShell` calls `getChatStrings(chatLanguage)` and passes result down to: `ChatPanel`, `SourcesPanel`, `Composer`, `MessageList`, and the inline `MobileHeader`. Strings switch at the same moment the language pill updates (after `fetchUserLanguage` resolves). Initial render shows English briefly — same behavior as the pill, acceptable.

---

## Evidence Label Localization

### Problem

`applyCitations()` in `citations.ts` styles the word `"Evidence:"` as a highlighted label chip. The API emits `"Evidencia:"` (Spanish) and `"Preuve:"` (French) in ES/FR responses — these appear as unstyled plain text.

### Fix (three targeted edits in `src/lib/markdown/citations.ts`)

**1. `EVIDENCE_PREFIX_RE`** — capture all three words:
```ts
// Before
const EVIDENCE_PREFIX_RE = /Evidence:/g;
// After
const EVIDENCE_PREFIX_RE = /(Evidence|Evidencia|Preuve):/g;
```

**2. `makeEvidenceLabel`** — accept the matched word:
```ts
// Before
function makeEvidenceLabel(): string {
  return `<span class="evidence-label">Evidence</span>`;
}
// After
function makeEvidenceLabel(word: string): string {
  return `<span class="evidence-label">${word}</span>`;
}
```

**3. `EVIDENCE_ROW_RE`** — update the HTML pattern that matches already-replaced label spans:
```ts
// Before (excerpt)
/<span class="evidence-label">Evidence<\/span>/
// After
/<span class="evidence-label">(?:Evidence|Evidencia|Preuve)<\/span>/
```

**4. `applyCitations` step 2** — pass captured word to label function:
```ts
// Before
result = result.replace(EVIDENCE_PREFIX_RE, makeEvidenceLabel());
// After
result = result.replace(EVIDENCE_PREFIX_RE, (_match, word) => makeEvidenceLabel(word));
```

---

## Answer Prefix Stripping for ES/FR

### Problem

The API emits `"Respuesta:"` (Spanish) and `"Réponse:"` (French) at the start of responses, matching the English `"Answer:"` pattern that already exists. The current regex in `answerDedup.ts` only matches English. As a result, the prefix appears literally in both the chat message bubbles and the SEO Q/[slug] answer pages for ES/FR.

Additionally, `TypewriterRenderer` (used on SEO Q pages) never calls `stripAnswerPrefix` at all — even for English. English Q pages appear clean only because the data in `seo_cache` was captured before the API started prepending the label.

### Fix

**`src/lib/utils/answerDedup.ts`** — extend the regex to match all three languages:

```ts
// Before
const ANSWER_PREFIX = /^(?:#{1,6}\s*)?(?:\*{1,2})?Answer:?(?:\*{1,2})?:?\s*/i;

// After
const ANSWER_PREFIX =
  /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Answer|Respuesta|R[eé]ponse):?(?:\*{1,2})?:?\s*/i;
```

**`src/components/seo/TypewriterRenderer.tsx`** — apply `stripAnswerPrefix` to the markdown before splitting into chunks, mirroring what `MessageBubble` already does:

```ts
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";
// in the component, strip before processing:
const cleaned = stripAnswerPrefix(markdown);
// use `cleaned` everywhere `markdown` was used
```

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/db/seo-queries.ts` | Add `fetchFaqListItems` with `unstable_cache` |
| `src/components/seo/FaqGrid.tsx` | New component |
| `src/app/faq/page.tsx` | Swap query + component, simplify JSON-LD |
| `src/app/[lang]/faq/page.tsx` | Swap query + component, simplify JSON-LD |
| `src/lib/utils/answerDedup.ts` | Extend regex to ES/FR prefixes |
| `src/components/seo/TypewriterRenderer.tsx` | Apply `stripAnswerPrefix` before rendering |
| `src/lib/i18n/chatStrings.ts` | New — EN/ES/FR chat UI string translations |
| `src/components/chat/ChatPanel.tsx` | Accept + use localized strings |
| `src/components/chat/SourcesPanel.tsx` | Accept + use localized strings |
| `src/components/chat/Composer.tsx` | Accept + use localized placeholder strings |
| `src/components/chat/MessageList.tsx` | Accept + use localized "Finalizing" string |
| `src/components/chat/ChatShell.tsx` | Wire `getChatStrings(chatLanguage)` to children |
| `src/lib/markdown/citations.ts` | Extend Evidence regex + label fn for ES/FR |

`FaqAccordion.tsx` — no change.

---

## Success Criteria

- `/faq`, `/es/faq`, `/fr/faq` render fast on cache hit
- Cards navigate correctly to `/q/[slug]`, `/es/q/[slug]`, `/fr/q/[slug]`
- JSON-LD `FAQPage` schema present and valid
- No new lint or TypeScript errors
- `FaqAccordion` still compiles (not deleted)