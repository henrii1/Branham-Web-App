# Passage N-gram Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Highlight literal query/passage word overlap (runs of 3+ consecutive words) in the Sources panel, on both the live chat UI and the public SEO answer pages.

**Architecture:** A new pure-function module (`src/lib/markdown/ngramHighlight.ts`) post-processes already-rendered passage HTML — tokenizing text segments outside headings, finding contiguous word-run overlaps with the query, and wrapping them in `<mark class="passage-highlight">`. It is wired into the two places passage HTML is currently rendered: `SourcesPanel.tsx` (chat) and `SeoShell.tsx` (SEO pages), which — contrary to the original design doc's assumption — do **not** share one code path today (see Correction below).

**Tech Stack:** Plain TypeScript (no new dependencies). No test runner exists in this repo (checked: no jest/vitest/testing-library in `package.json`, no `*.test.ts` files anywhere) — `tsx` is already a devDependency, so verification of the pure-function module uses a throwaway `tsx`-run assertion script (deleted once it passes), and the wiring tasks are verified manually via the dev server (SourcesPanel already has no test coverage either — this matches existing project practice, not a gap introduced by this plan).

**Source spec:** `docs/superpowers/specs/2026-07-26-passage-ngram-highlighting-design.md` (Approved).

## Correction to the source spec

The spec states "both render through the same shared `SourcesPanel` component." That's not true of the current codebase: `SeoShell.tsx` has its own independent passage-HTML pipeline (`const ragHtml = renderMarkdown(postprocessRag(ragContext))` at `SeoShell.tsx:122-123`, consumed at two render sites — desktop `SeoShell.tsx:718` and mobile `SeoShell.tsx:803`) and never imports `SourcesPanel`. This plan wires the highlighter into **both** independent pipelines to achieve the spec's actual goal (highlighting shows up everywhere passages are shown); Task 2 covers `SourcesPanel.tsx`, Task 3 covers `SeoShell.tsx` plus its two page-level callers.

## Global Constraints

- Matching is purely literal, contiguous, word-level n-gram overlap — no stemming, fuzzy matching, or semantic similarity (spec Non-Goals).
- Minimum run length to highlight: **3 consecutive words**, same order, in both query and passage token lists. Runs of 1–2 words are not highlighted.
- Normalization for comparison only (never changes displayed text): NFKD-normalize + strip combining diacritical marks, lowercase, then tokenize on runs of letters/digits (this implicitly strips punctuation — no separate punctuation-stripping step is needed since non-letter/digit characters are already token separators).
- Never highlight inside headings (`<h1>`–`<h6>`) — only passage body text is eligible.
- No changes to the Python RAG API, `rag_context`'s markdown format, or the chat answer panel's existing citation-pill rendering (spec Non-Goals / Out of Scope).
- The highlighter operates only on HTML that `renderMarkdown` (our own trusted code, via `marked` with all raw-HTML passthrough disabled) produced — never on arbitrary/external HTML — so a regex-based tag/text split is safe, matching the safety argument `citations.ts` already relies on.
- Query input: `RagData.retrievalQuery` for chat (`src/lib/chat/types.ts:9`, already the exact field the spec names); `SeoCacheRow.robust_query` for SEO pages (the query actually used to produce that page's cached `rag_context` — the correct analog, not the raw display `question`).

---

## Task 1: `ngramHighlight.ts` core module

**Files:**
- Create: `src/lib/markdown/ngramHighlight.ts`
- Verify: throwaway `.worktrees/ngram-highlighting/scratch-verify-ngram.ts` (delete after it passes — not part of the feature)

**Interfaces:**
- Produces: `applyNgramHighlights(html: string, query: string): string` — the only export later tasks consume.

- [ ] **Step 1: Write the module**

```ts
// src/lib/markdown/ngramHighlight.ts
/**
 * Passage n-gram highlighting — literal query/passage word overlap in the
 * Sources panel (chat + SEO pages). Post-processes already-rendered HTML
 * the same way citations.ts styles the chat answer panel: as a regex-based
 * pass over HTML our own renderMarkdown produced (never arbitrary external
 * HTML), so a plain tag/text split is safe.
 */

interface WordToken {
  /** Normalized (NFKD-stripped, lowercased) form used for comparison only. */
  word: string;
  /** Char offset range in the ORIGINAL (unmodified) text this token came from. */
  start: number;
  end: number;
}

interface MatchSpan {
  startTokenIdx: number;
  endTokenIdx: number;
  start: number;
  end: number;
}

const MIN_RUN_LENGTH = 3;
// Unicode-aware run of letters/digits — everything else (punctuation,
// whitespace, HTML entity markup like "&amp;") acts as a separator, so
// tokenizing already strips punctuation; no separate step is needed.
const WORD_RE = /[\p{L}\p{N}]+/gu;
const HEADING_OPEN_RE = /^<h[1-6][\s>]/i;
const HEADING_CLOSE_RE = /^<\/h[1-6]>/i;
const TAG_RE = /<[^>]+>/g;

function normalizeWord(raw: string): string {
  return raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(text)) !== null) {
    tokens.push({
      word: normalizeWord(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/**
 * Greedy left-to-right scan: at each unconsumed passage token, find the
 * longest run (>= MIN_RUN_LENGTH) that matches a contiguous run anywhere in
 * the query tokens. Both lists are short (a handful of query words; a
 * paragraph-sized passage), so trying every query start position per
 * passage position is cheap — no LCS/suffix-array needed.
 */
function findMatchRuns(passageTokens: WordToken[], queryTokens: string[]): MatchSpan[] {
  const spans: MatchSpan[] = [];
  const n = passageTokens.length;
  const m = queryTokens.length;
  let i = 0;
  while (i < n) {
    let bestLen = 0;
    for (let j = 0; j < m; j++) {
      if (passageTokens[i].word !== queryTokens[j]) continue;
      let len = 1;
      while (
        i + len < n &&
        j + len < m &&
        passageTokens[i + len].word === queryTokens[j + len]
      ) {
        len++;
      }
      if (len > bestLen) bestLen = len;
    }
    if (bestLen >= MIN_RUN_LENGTH) {
      spans.push({
        startTokenIdx: i,
        endTokenIdx: i + bestLen - 1,
        start: passageTokens[i].start,
        end: passageTokens[i + bestLen - 1].end,
      });
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return spans;
}

/**
 * Merges spans whose token ranges are directly back-to-back (no words in
 * between) into one continuous span, so two qualifying runs that happen to
 * sit right next to each other in the passage render as a single unbroken
 * highlight instead of two marks with a seam between them.
 */
function mergeAdjacentSpans(spans: MatchSpan[]): MatchSpan[] {
  if (spans.length === 0) return spans;
  const merged: MatchSpan[] = [spans[0]];
  for (let k = 1; k < spans.length; k++) {
    const prev = merged[merged.length - 1];
    const curr = spans[k];
    if (curr.startTokenIdx === prev.endTokenIdx + 1) {
      merged[merged.length - 1] = {
        startTokenIdx: prev.startTokenIdx,
        endTokenIdx: curr.endTokenIdx,
        start: prev.start,
        end: curr.end,
      };
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

function wrapSpans(text: string, spans: MatchSpan[]): string {
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += text.slice(cursor, span.start);
    result += `<mark class="passage-highlight">${text.slice(span.start, span.end)}</mark>`;
    cursor = span.end;
  }
  result += text.slice(cursor);
  return result;
}

function highlightSegment(text: string, queryTokens: string[]): string {
  const tokens = tokenize(text);
  if (tokens.length < MIN_RUN_LENGTH) return text;
  const spans = mergeAdjacentSpans(findMatchRuns(tokens, queryTokens));
  if (spans.length === 0) return text;
  return wrapSpans(text, spans);
}

/**
 * Wraps literal query/passage n-gram overlaps (runs of >= 3 consecutive
 * words, in order) in `<mark class="passage-highlight">` inside already-
 * rendered passage HTML. Never highlights inside headings (h1-h6), so
 * sermon titles/section headers stay untouched — only passage body text
 * is eligible.
 */
export function applyNgramHighlights(html: string, query: string): string {
  if (!html || !query) return html;
  const queryTokens = tokenize(query).map((t) => t.word);
  if (queryTokens.length < MIN_RUN_LENGTH) return html;

  let result = "";
  let cursor = 0;
  let headingDepth = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(html)) !== null) {
    const textSegment = html.slice(cursor, match.index);
    if (textSegment) {
      result += headingDepth > 0 ? textSegment : highlightSegment(textSegment, queryTokens);
    }
    const tag = match[0];
    if (HEADING_OPEN_RE.test(tag)) headingDepth++;
    else if (HEADING_CLOSE_RE.test(tag)) headingDepth = Math.max(0, headingDepth - 1);
    result += tag;
    cursor = TAG_RE.lastIndex;
  }
  const rest = html.slice(cursor);
  if (rest) result += headingDepth > 0 ? rest : highlightSegment(rest, queryTokens);
  return result;
}
```

- [ ] **Step 2: Write and run the verification script**

Create `scratch-verify-ngram.ts` at the worktree root (sibling of `package.json`, so the `@/` path alias isn't needed — import by relative path instead):

```ts
// scratch-verify-ngram.ts — throwaway, delete after this step passes.
import { applyNgramHighlights } from "./src/lib/markdown/ngramHighlight";

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}`);
    console.error(`  expected: ${expected}`);
    console.error(`  actual:   ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// 1. Basic 3-word match gets wrapped. Query deliberately does NOT start
// with "the" — the passage's leading "The" would otherwise extend the
// match by one extra word, since it normalizes equal to a query "the".
assertEqual(
  applyNgramHighlights("<p>The seal of God is the baptism.</p>", "seal of God"),
  '<p>The <mark class="passage-highlight">seal of God</mark> is the baptism.</p>',
  "basic 3-word match",
);

// 2. A query with a 2-word contiguous overlap (and no 3-word one) must
// leave the passage untouched — the "the seal" prefix run is only 2 words
// long even though the query itself has 3 words.
assertEqual(
  applyNgramHighlights("<p>The seal was broken that day.</p>", "the seal broken"),
  "<p>The seal was broken that day.</p>",
  "2-word run ignored even with a qualifying-length query",
);

// 3. Headings are never highlighted even when they textually overlap.
assertEqual(
  applyNgramHighlights(
    "<h3>The Seal Of God Explained</h3><p>The seal of God is real.</p>",
    "seal of god",
  ),
  '<h3>The Seal Of God Explained</h3><p>The <mark class="passage-highlight">seal of God</mark> is real.</p>',
  "heading text excluded, body text still highlighted",
);

// 4. Diacritic-insensitive matching (café / cafe).
assertEqual(
  applyNgramHighlights("<p>We met at the café downtown.</p>", "met at the cafe"),
  '<p>We <mark class="passage-highlight">met at the café</mark> downtown.</p>',
  "diacritic-insensitive match",
);

// 5. No match at all passes through unchanged.
assertEqual(
  applyNgramHighlights("<p>Completely unrelated sentence here.</p>", "seal of God"),
  "<p>Completely unrelated sentence here.</p>",
  "no overlap leaves html untouched",
);

// 6. Two disjoint 3-word query runs ("alpha beta gamma" and "delta epsilon
// zeta", separated by "omega" in the query) that happen to sit back-to-back
// in the passage (no words between them) must merge into ONE continuous
// mark, not two adjacent marks with a seam. Greedy matching finds these as
// two separate maximal runs (the passage never contains "gamma delta" as a
// query-contiguous pair, so it can't be found as one run directly) — this
// is what actually exercises mergeAdjacentSpans.
assertEqual(
  applyNgramHighlights(
    "<p>alpha beta gamma delta epsilon zeta</p>",
    "alpha beta gamma omega delta epsilon zeta psi",
  ),
  '<p><mark class="passage-highlight">alpha beta gamma delta epsilon zeta</mark></p>',
  "two adjacent disjoint runs merge into one mark",
);

// 7. Query with fewer than 3 words never highlights anything.
assertEqual(
  applyNgramHighlights("<p>The seal of God is real.</p>", "seal God"),
  "<p>The seal of God is real.</p>",
  "sub-3-word query never highlights",
);

console.log(process.exitCode === 1 ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
```

Run: `npx tsx scratch-verify-ngram.ts`
Expected output: seven `PASS:` lines and `ALL CHECKS PASSED`, exit code 0.

If any check fails, fix `ngramHighlight.ts` and re-run — do not proceed to Step 3 until all seven pass.

- [ ] **Step 3: Delete the scratch script and typecheck**

```bash
rm scratch-verify-ngram.ts
npx tsc --noEmit
```

Expected: no new errors (the pre-existing `ChatShell.tsx(748,...)` error from an unrelated in-flight branch is expected and not caused by this change — confirm the error list is unchanged from before this task).

- [ ] **Step 4: Commit**

```bash
git add src/lib/markdown/ngramHighlight.ts
git commit -m "feat(ngram): add passage n-gram highlighting core module"
```

---

## Task 2: Wire into the chat Sources panel + CSS

**Files:**
- Modify: `src/components/chat/SourcesPanel.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `applyNgramHighlights(html: string, query: string): string` from Task 1.

- [ ] **Step 1: Add the CSS**

In `src/app/globals.css`, insert immediately before the existing `/* Sources panel markdown: slightly muted, compact styling */` comment (the block starting with `.sources-markdown h3`):

```css
/* ── Passage n-gram highlight — Sources panel only ────────────────────
 * Subtle background tint marking literal query/passage word overlap.
 * Deliberately a different hue from .citation-pill (blue) so the two
 * styles never read as the same affordance if they ever appear near
 * each other.
 */
.passage-highlight {
  background-color: rgba(250, 204, 21, 0.35);
  border-radius: 3px;
  padding: 0 1px;
  color: inherit;
}

.dark .passage-highlight {
  background-color: rgba(250, 204, 21, 0.22);
}

```

- [ ] **Step 2: Wire the highlighter into `SourcesPanel.tsx`**

Change the top import block — add:

```ts
import { applyNgramHighlights } from "@/lib/markdown/ngramHighlight";
```

Change the `renderedHtml` memo (currently):

```ts
  const renderedHtml = useMemo(() => {
    if (!ragData) return "";
    const cleaned = postprocessRag(ragData.ragContext);
    return renderMarkdown(cleaned);
  }, [ragData]);
```

to:

```ts
  const renderedHtml = useMemo(() => {
    if (!ragData) return "";
    const cleaned = postprocessRag(ragData.ragContext);
    const html = renderMarkdown(cleaned);
    return applyNgramHighlights(html, ragData.retrievalQuery);
  }, [ragData]);
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint src/components/chat/SourcesPanel.tsx
```

Expected: clean (same pre-existing unrelated `ChatShell.tsx` error only).

- [ ] **Step 4: Manual verification via dev server**

```bash
npm run dev
```

In a browser (or via Playwright), open `/chat`, ask a question likely to produce literal word overlap between the query and a retrieved passage (e.g. "What is the seal of God?"), open the Sources tab/panel, and confirm:
- At least one amber-highlighted span (`<mark class="passage-highlight">`) appears inside passage body text.
- No highlight appears inside any sermon-title/section heading text.
- Passages with no literal overlap render exactly as before (no marks, no layout shift).
- Toggle dark mode and confirm the highlight is still visibly legible (dimmer tint per the `.dark` rule).

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/SourcesPanel.tsx src/app/globals.css
git commit -m "feat(ngram): highlight passage n-gram overlap in the chat Sources panel"
```

---

## Task 3: Wire into SEO answer pages

**Files:**
- Modify: `src/components/seo/SeoShell.tsx`
- Modify: `src/app/q/[slug]/page.tsx`
- Modify: `src/app/[lang]/q/[slug]/page.tsx`

**Interfaces:**
- Consumes: `applyNgramHighlights(html: string, query: string): string` from Task 1.
- Consumes: `SeoCacheRow.robust_query: string` (already fetched by `fetchSeoPage` today — `src/lib/db/seo-queries.ts:7`, already included in `SEO_COLUMNS`) — currently fetched but not passed to `SeoShell`.

- [ ] **Step 1: Add the `retrievalQuery` prop to `SeoShellProps`**

In `src/components/seo/SeoShell.tsx`, change:

```ts
interface SeoShellProps {
  slug: string;
  question: string;
  answerMarkdown: string;
  ragContext: string;
  conversationSummary: string | null;
  nextPage: { slug: string; question: string } | null;
  language: string;
  langHrefs: { en: string; es: string; fr: string };
}
```

to:

```ts
interface SeoShellProps {
  slug: string;
  question: string;
  answerMarkdown: string;
  ragContext: string;
  retrievalQuery: string;
  conversationSummary: string | null;
  nextPage: { slug: string; question: string } | null;
  language: string;
  langHrefs: { en: string; es: string; fr: string };
}
```

And update the destructured props in the component signature — change:

```ts
export function SeoShell({
  slug,
  question,
  answerMarkdown,
  ragContext,
  conversationSummary,
  nextPage,
  language,
  langHrefs,
}: SeoShellProps) {
```

to:

```ts
export function SeoShell({
  slug,
  question,
  answerMarkdown,
  ragContext,
  retrievalQuery,
  conversationSummary,
  nextPage,
  language,
  langHrefs,
}: SeoShellProps) {
```

- [ ] **Step 2: Add the import and wire the highlighter into `ragHtml`**

Add near the other `@/lib/markdown/*` imports:

```ts
import { applyNgramHighlights } from "@/lib/markdown/ngramHighlight";
```

Change:

```ts
  const processedRag = postprocessRag(ragContext);
  const ragHtml = renderMarkdown(processedRag);
```

to:

```ts
  const processedRag = postprocessRag(ragContext);
  const ragHtml = applyNgramHighlights(renderMarkdown(processedRag), retrievalQuery);
```

(Both existing consumers of `ragHtml` — the desktop passages panel and the mobile sources tab — pick this up automatically; no other change needed in this file.)

- [ ] **Step 3: Pass the prop from `src/app/q/[slug]/page.tsx`**

Change the `<SeoShell ... />` call:

```tsx
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={page.language ?? "en"}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
```

to:

```tsx
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context}
        retrievalQuery={page.robust_query}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={page.language ?? "en"}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
```

- [ ] **Step 4: Pass the prop from `src/app/[lang]/q/[slug]/page.tsx`**

Change the `<SeoShell ... />` call:

```tsx
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context ?? ""}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={l}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
```

to:

```tsx
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context ?? ""}
        retrievalQuery={page.robust_query}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={l}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
```

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint src/components/seo/SeoShell.tsx src/app/q/\[slug\]/page.tsx "src/app/\[lang\]/q/\[slug\]/page.tsx"
```

Expected: clean (same pre-existing unrelated `ChatShell.tsx` error only).

- [ ] **Step 6: Manual verification via dev server**

```bash
npm run dev
```

Find a real published `/q/[slug]` page whose question shares literal wording with its retrieved passages (any existing page is fine — check a few if the first has no literal overlap, since that's an expected, valid outcome per the spec's Goals section). Open it in a browser (or via Playwright) and confirm:
- The Passages panel (desktop) and the Sources tab (mobile, swipe or tap over) show amber highlights on literal overlaps, same visual treatment as the chat panel.
- No highlight appears inside the sermon-title headings within the passages.
- The typewriter-animated answer panel and SSR `sr-only` answer block are unaffected (highlighting is Sources-panel-only, per spec Non-Goals).
- Also spot-check an `/[lang]/q/[slug]` (es or fr) page the same way.

Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/seo/SeoShell.tsx "src/app/q/[slug]/page.tsx" "src/app/[lang]/q/[slug]/page.tsx"
git commit -m "feat(ngram): highlight passage n-gram overlap on SEO answer pages"
```

---

## Task 4: Documentation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Update the source layout tree**

In `CLAUDE.md`, in the `### Source layout` tree, change:

```
│   ├── markdown/
│   │   ├── render.ts                       # marked + sanitization (no raw HTML)
│   │   ├── citations.ts                    # Citation pills + Evidence label + truncateAfterFirstCitation (share-card excerpt)
│   │   ├── chatPostprocess.ts              # --- dividers, Reader Note normalization
│   │   └── ragPostprocess.ts               # Strip boilerplate from RAG context
```

to:

```
│   ├── markdown/
│   │   ├── render.ts                       # marked + sanitization (no raw HTML)
│   │   ├── citations.ts                    # Citation pills + Evidence label + truncateAfterFirstCitation (share-card excerpt)
│   │   ├── chatPostprocess.ts              # --- dividers, Reader Note normalization
│   │   ├── ragPostprocess.ts               # Strip boilerplate from RAG context
│   │   └── ngramHighlight.ts               # ★ Literal query/passage word-overlap highlighting (Sources panel only)
```

- [ ] **Step 2: Add a short section after "Conversation sharing"**

Insert a new `##` section after the "Conversation sharing" section (before "## Deployment (Cloudflare Workers via OpenNext)"):

```markdown
## Passage n-gram highlighting

`src/lib/markdown/ngramHighlight.ts` (`applyNgramHighlights(html, query)`) highlights literal, contiguous word-overlap (3+ consecutive words, same order) between the retrieval query and each retrieved passage, in the Sources panel only — never in the chat answer panel, which already has its own citation-pill styling. Purely literal matching (NFKD diacritic-insensitive, lowercase, punctuation-agnostic via tokenization) — no stemming or semantic scoring, so many relevant passages will show no highlight at all when they were retrieved by dense/semantic search rather than keyword overlap. That's expected.

It's a post-processing pass over already-rendered HTML (same safety argument as `citations.ts`: the HTML comes only from our own `renderMarkdown`, never arbitrary external HTML), wired into the two independent places passage HTML is rendered:

- **Chat** (`SourcesPanel.tsx`): `applyNgramHighlights(renderMarkdown(postprocessRag(ragData.ragContext)), ragData.retrievalQuery)`.
- **SEO pages** (`SeoShell.tsx`): same shape, keyed on `SeoCacheRow.robust_query` (the query actually used to produce that page's cached `rag_context`) rather than the display `question`.

Note these two call sites are genuinely independent — `SeoShell.tsx` does not render through `SourcesPanel`, despite what an earlier version of this feature's design doc assumed. If either passage-rendering path changes, check whether the other needs the same change.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document passage n-gram highlighting"
```
