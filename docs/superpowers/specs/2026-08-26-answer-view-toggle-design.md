# Answer view toggle ("Full Answer" / "Sermon Quotes") — design spec

## Purpose

Some users don't want the AI's synthesis at all — they want to compare sermon
quotes directly, in the order the assistant cited them, and click straight
into the sermon text. Today the only way to see a citation is to spot it
inline inside the AI's prose. This adds a second, complete view of each
answer: a plain ordered, deduplicated list of every sermon reference cited in
that answer, with no AI narrative around them, using the exact same clickable
citation-pill mechanism the chat already has.

## Scope

- **In scope**: the authenticated/anonymous chat window (`ChatShell`, both
  the desktop two-panel layout and the mobile sliding-tab layout).
- **Out of scope**: the public read-only share pages (`/share/[hash]`,
  `/[lang]/share/[hash]`). `MessageBubble` is reused verbatim there
  (`SharePageShell`); it gets a new optional prop but the share page never
  passes it, so its rendering is unchanged.
- **Out of scope**: the SEO `/q/[slug]` pages — they don't use `ChatShell` or
  `MessageBubble` at all.

## UX

**Toggle**: one global, two-segment pill switch — **"Full Answer"** /
**"Sermon Quotes"** — mounted in `ChatPanel`'s own header strip, top-right.
That header strip exists today but is mobile-only (`lg:hidden`, showing just
the text "Chat"); it becomes always-visible. On mobile it keeps the "Chat"
label plus the toggle; on desktop it drops the (redundant) label and shows
just the toggle, right-aligned — giving the desktop Chat panel a header row
for the first time, matching `SourcesPanel`'s existing header so the two
stacked panels have symmetric chrome.

Visually a compact segmented control in the same rounded-full / zinc-palette
language as `ChatLanguagePill` and the citation pills themselves — not
icon-only, since "Full Answer" vs "Sermon Quotes" isn't self-evident from a
glyph.

The toggle is **one switch for the whole conversation**: flipping it
re-renders every assistant message in the thread between the two views at
once. It is **not** per-message.

**"Full Answer" mode**: today's rendering, byte-for-byte unchanged.

**"Sermon Quotes" mode**: each assistant message renders as a plain vertical
list of citation pills — one row per unique reference, in first-appearance
order, scanning the *entire* answer (inline citations, Quotes section,
References section — wherever they occur; the extraction doesn't care about
section boundaries). Each pill is clickable exactly like an inline citation
pill today — same `.citation-pill--clickable` markup and `data-references`
payload, so `ReferencePopover`'s existing delegated click listener opens the
sermon-text popover with zero new plumbing.

- **Dedup key**: exact citation — same `date_id` **and** same paragraph
  range. Two citations of the same sermon with different paragraph ranges
  both survive as separate rows; a second citation of the *exact* same
  range is dropped.
- **Dedup scope**: per answer. Each assistant message computes its own
  deduped list independently; an earlier answer's citations do not suppress
  a later answer's.
- **User messages**: unaffected by the mode — always render as today.
- **Streaming**: a message still streaming in ignores the mode entirely and
  always shows the live streaming markdown (`StreamingText`, unchanged). Only
  once `MessageBubble` takes over on the `final` event does the mode apply.
- **Empty state**: an answer with zero extractable citations shows a single
  muted, localized line ("No sermon quotes cited in this answer.") instead of
  an empty list.

**Persistence**: the chosen mode is stored in `sessionStorage` (new key,
alongside the existing `MOBILE_ACTIVE_TAB_KEY` pattern), so it survives a
reload or switching conversations within the same tab session, but is not
tied to any one conversation.

## Architecture

### Extraction & dedup — `src/lib/markdown/citations.ts`

This file already privately owns the strict citation-bracket regex
(`CITATION_RE`) and the per-bracket parser (`parseCitationReferences`) that
`applyCitations`/`makePill` use to turn `[TITLE — DATE_ID: ¶X–¶Y]` text into
clickable pills. Per this repo's existing convention (documented in
`CLAUDE.md`'s citation section), that regex must stay a single source of
truth — quoted sermon excerpts can contain other bracketed text (e.g. `[…]`
marking omitted words) that a looser match would misidentify as a citation.
The new logic reuses these same primitives rather than re-implementing
matching elsewhere.

New exports:

```ts
export interface CitationEntry {
  date_id: string;
  title: string;
  ranges: CitationRange[];
}

/**
 * Scans `html` (post-renderMarkdown, pre-applyCitations) for every citation
 * bracket in document order, expanding a multi-sermon bracket into one entry
 * per sermon — the same expansion applyCitations already does for inline
 * pills. No awareness of "sections" — a citation counts wherever it appears.
 */
export function extractOrderedCitations(html: string): CitationEntry[];

/**
 * Keeps the first occurrence of each exact citation (date_id + paragraph
 * range) and drops later duplicates.
 */
export function dedupeCitations(entries: CitationEntry[]): CitationEntry[];

/**
 * Renders a deduped, ordered citation list as one clickable pill per row.
 * Reuses the existing single-pill builder, so each row carries the same
 * `.citation-pill--clickable` class and `data-references` JSON payload that
 * ReferencePopover's delegated listener already handles.
 */
export function renderCitationList(entries: CitationEntry[]): string;
```

`extractOrderedCitations` must run against the **rendered HTML** (the same
string `renderMarkdown()` produces, before `applyCitations` wraps it in pill
spans), not raw markdown — title text is only HTML-entity-escaped by `marked`
at that point, which is the same escaping assumption the existing
`makeSinglePill` docstring already documents. Extracting from raw markdown
would reintroduce an injection risk that today's pipeline already avoids.

### Component wiring

- **`ChatShell`**: new state `answerViewMode: "full" | "quotes"`, initialized
  from `sessionStorage` (new key, mirrors `getStoredMobileTab`/
  `MOBILE_ACTIVE_TAB_KEY`), written back on change. Passed as
  `answerViewMode` + `onAnswerViewModeChange` props into **both**
  `ChatPanel` instances (desktop two-panel layout and mobile sliding-tab
  layout — both are always mounted simultaneously today, shown/hidden purely
  via CSS media classes, so lifting the state once keeps both in sync
  automatically across a viewport resize with no extra code).
- **`ChatPanel`**: header strip (`flex items-center border-b ...`) loses its
  `lg:hidden`. Renders the new `AnswerViewToggle` component right-aligned;
  the existing "Chat" `<h2>` label keeps its own `lg:hidden` so it stays
  mobile-only. Passes `answerViewMode` through to `MessageList`.
- **New file `src/components/chat/AnswerViewToggle.tsx`**: small
  presentational two-segment pill switch, `role="tablist"`/`role="tab"` pair,
  takes `mode` + `onChange` + `strings`. Follows the file-per-concern pattern
  already used for other small chat components (`DragDivider.tsx`,
  `SwipeAffordance.tsx`).
- **`MessageList`**: accepts `mode` prop, passes to `MessageBubble` for each
  historical message. `StreamingText` (the in-progress message) does **not**
  receive it — unaffected by design.
- **`MessageBubble`**: new optional prop `mode?: "full" | "quotes"` (default
  `"full"`). User messages (`isUser`) ignore it completely — no branch
  change to that path at all. Assistant messages: the existing `useMemo`
  gains `mode` to its dependency array and branches after computing `html`
  (the shared `renderMarkdown(processed)` result):
  - `"full"` → `applyCitations(html)` (today's code path, unchanged).
  - `"quotes"` → `dedupeCitations(extractOrderedCitations(html))`; if
    non-empty, `renderCitationList(...)`; if empty, the localized empty-state
    string rendered as a single muted paragraph.
- **`SharePageShell`**: does not pass `mode` — untouched, renders `"full"`
  by default, matching current behavior exactly.

### i18n — `src/lib/i18n/chatStrings.ts`

Three new keys added to all three language blocks (en/es/fr), following the
existing naming convention:

- `answerViewFullLabel` — "Full Answer" / "Respuesta completa" / "Réponse complète"
- `answerViewQuotesLabel` — "Sermon Quotes" / "Citas del sermón" / "Citations du sermon"
- `answerViewQuotesEmpty` — "No sermon quotes cited in this answer." (+ es/fr)

## Error handling

There is no new network call and no new failure mode — this is a pure
client-side rendering-mode switch over data that's already loaded. The only
edge case is the empty-citations case above, handled as a designed empty
state rather than an error.

## Testing

This repo has no test runner configured (no Jest/Vitest, no `*.test.ts`
files) — verification is manual, per `CLAUDE.md`'s standing UI-testing
guidance. Plan:

- Manual QA in the browser (`npm run dev`) covering:
  - Toggling mid-conversation with multiple prior answers — all switch at
    once.
  - An answer with citations only inline (none in a References section) —
    confirm they still appear in "Sermon Quotes" mode.
  - An answer with duplicate citations (same date_id, same range) — confirm
    only one row.
  - An answer citing the same sermon twice with different paragraph ranges —
    confirm both rows survive.
  - An answer with zero citations — confirm the empty-state line.
  - A message actively streaming in while mode is "Sermon Quotes" — confirm
    it still streams live text, then switches over on completion.
  - Clicking a pill in "Sermon Quotes" mode opens `ReferencePopover`
    identically to an inline pill.
  - Mobile viewport (toggle synced between the two `ChatPanel` instances
    across a resize) and desktop viewport.
  - Reload / switch conversations — mode persists per the `sessionStorage`
    key.
  - Public share page (`/share/[hash]`) — confirm zero visual change (no
    toggle, "Full Answer" rendering only).
- No automated tests are added, matching the rest of this codebase.
