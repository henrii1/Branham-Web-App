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

Both FAQ pages currently generate a `FAQPage` schema with excerpts derived from `answer_markdown`. With the new lean query, the answer text for the schema uses `meta_description` instead (already a short human-readable summary). If `meta_description` is null for a row, that item is omitted from the JSON-LD `mainEntity` array rather than included with empty text.

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

## Files Changed

| File | Change |
|---|---|
| `src/lib/db/seo-queries.ts` | Add `fetchFaqListItems` with `unstable_cache` |
| `src/components/seo/FaqGrid.tsx` | New component |
| `src/app/faq/page.tsx` | Swap query + component, simplify JSON-LD |
| `src/app/[lang]/faq/page.tsx` | Swap query + component, simplify JSON-LD |

`FaqAccordion.tsx` — no change.

---

## Success Criteria

- `/faq`, `/es/faq`, `/fr/faq` render fast on cache hit
- Cards navigate correctly to `/q/[slug]`, `/es/q/[slug]`, `/fr/q/[slug]`
- JSON-LD `FAQPage` schema present and valid
- No new lint or TypeScript errors
- `FaqAccordion` still compiles (not deleted)