# Answer View Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global "Full Answer" / "Sermon Quotes" toggle to the chat window (both desktop and mobile) that switches every assistant message between today's AI-rendered answer and a plain, deduplicated, clickable list of every sermon reference cited in that answer.

**Architecture:** A new pair of pure functions in `src/lib/markdown/citations.ts` (`extractOrderedCitations`, `dedupeCitations`) plus a rendering helper (`renderCitationList`) reuse the existing single-citation-pill builder so the "Sermon Quotes" list is clickable via the same `ReferencePopover` delegated listener with zero new click-handling code. A new `answerViewMode` state lives in `ChatShell`, threaded as a prop through both always-mounted `ChatPanel` instances (desktop + mobile) down to `MessageList` and `MessageBubble`, which branches its render between the existing `applyCitations` path and the new citation-list path.

**Tech Stack:** Plain TypeScript/React, no new dependencies. No test runner exists in this repo (confirmed: no jest/vitest in `package.json`, no `*.test.ts` files) — `tsx` is already a devDependency, so the pure-function task (Task 1) is verified with a throwaway `tsx`-run assertion script (deleted once it passes, never committed); every other task is verified with `npm run lint` (type-check via the Next.js ESLint config) plus manual browser QA via `npm run dev`, matching this codebase's existing practice.

**Spec:** `docs/superpowers/specs/2026-08-26-answer-view-toggle-design.md`

## Global Constraints

- Toggle is **one global switch** for the whole conversation, not per-message (spec §UX).
- Dedup key is **exact citation** — same `date_id` AND same paragraph range. A second citation of the same sermon with a *different* range is kept, not dropped (spec §UX).
- Dedup is **per answer** — each assistant message computes its own list independently; no cross-message suppression (spec §UX).
- User messages are **never** affected by the mode (spec §UX).
- A message still **streaming in** always renders live text regardless of mode; the mode only applies once `MessageBubble` takes over on `final` (spec §UX).
- `extractOrderedCitations` must run on the **rendered HTML** (`renderMarkdown()` output), never raw markdown — title text is only HTML-entity-escaped at that point, which is the same assumption `makeSinglePill`'s existing docstring documents (spec §Architecture).
- The public share page (`SharePageShell` → `MessageBubble`) is **out of scope** — `mode` defaults to `"full"` and the share page never passes it, so it renders exactly as it does today.
- Segment labels: **"Full Answer"** / **"Sermon Quotes"** (en), with es/fr equivalents per Task 2's table — do not use "AI Answer" or "Raw" (rejected during brainstorming).

---

## Task 1: Citation extraction, dedup, and list rendering

**Files:**
- Modify: `src/lib/markdown/citations.ts`
- Verify: `src/lib/markdown/__verify_citations.ts` (throwaway, delete before committing)

**Interfaces:**
- Produces: `export interface CitationEntry { date_id: string; title: string; ranges: CitationRange[] }`, `export function extractOrderedCitations(html: string): CitationEntry[]`, `export function dedupeCitations(entries: CitationEntry[]): CitationEntry[]`, `export function renderCitationList(entries: CitationEntry[]): string`. Later tasks (Task 4) import these three functions and the type from `@/lib/markdown/citations`.

This task **renames the existing private `ParsedSermonRef` interface to an exported `CitationEntry`** (same shape, just exported) rather than introducing a duplicate type — `parseCitationReferences` and `makeSinglePill` already use it internally and their signatures change to match.

- [ ] **Step 1: Rename `ParsedSermonRef` to exported `CitationEntry`**

In `src/lib/markdown/citations.ts`, find the private interface (currently around line 131):

```ts
interface ParsedSermonRef {
  date_id: string;
  title: string;
  ranges: CitationRange[];
}
```

Replace with:

```ts
export interface CitationEntry {
  date_id: string;
  title: string;
  ranges: CitationRange[];
}
```

Then update the two other references to the old name in the same file:
- `function parseCitationReferences(innerText: string): ParsedSermonRef[] {` → `function parseCitationReferences(innerText: string): CitationEntry[] {`
- `function makeSinglePill(ref: ParsedSermonRef): string {` → `function makeSinglePill(ref: CitationEntry): string {`

- [ ] **Step 2: Write the throwaway verification script (before implementing the new functions, so it fails first)**

Create `src/lib/markdown/__verify_citations.ts`:

```ts
import assert from "node:assert/strict";
import {
  extractOrderedCitations,
  dedupeCitations,
  renderCitationList,
} from "./citations";

// A multi-sermon bracket, mid-sentence — not inside a "References" section.
// Extraction must not care about section headings.
const html1 =
  '<p>He said this [GODHEAD — 61-0425B: &para;122–&para;126; Q&amp;A — 54-0515: &para;210–&para;216] plainly.</p>';
const entries1 = extractOrderedCitations(html1);
assert.equal(entries1.length, 2, "expected 2 entries from one multi-sermon bracket");
assert.equal(entries1[0].date_id, "61-0425B");
assert.equal(entries1[1].date_id, "54-0515");

// Exact-duplicate citation (same date_id AND same range) is dropped;
// same sermon with a DIFFERENT range survives as its own entry.
const html2 =
  '<p>[SERMON A — 63-1116B: &para;10–&para;12] ... [SERMON A — 63-1116B: &para;10–&para;12] ... [SERMON A — 63-1116B: &para;45]</p>';
const deduped = dedupeCitations(extractOrderedCitations(html2));
assert.equal(deduped.length, 2, "expected duplicate range dropped, distinct range kept");
assert.equal(deduped[0].ranges[0].paragraph_start, 10);
assert.equal(deduped[1].ranges[0].paragraph_start, 45);

// renderCitationList produces one clickable pill row per entry.
const listHtml = renderCitationList(deduped);
const rowCount = (listHtml.match(/citation-pill--clickable/g) || []).length;
assert.equal(rowCount, 2, "expected one clickable pill per deduped entry");
assert.match(listHtml, /data-references="/, "expected data-references payload on each pill");

// Zero citations in the source text -> zero entries (empty-state case).
assert.equal(extractOrderedCitations("<p>No citations here.</p>").length, 0);

console.log("citations.ts verification: OK");
```

Note: the literal `¶` character in the source HTML is written as `&para;` in this script purely to avoid encoding issues copy-pasting this plan document — `CITATION_RE` matches the literal `¶` character, so when you create the file, replace both `&para;` occurrences in `html1` and both pairs in `html2` with the actual `¶` character (U+00B6), typed directly.

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx tsx src/lib/markdown/__verify_citations.ts`
Expected: `TS2305` / `TS2724`-style compile error — `extractOrderedCitations`, `dedupeCitations`, `renderCitationList` don't exist yet.

- [ ] **Step 4: Implement the three new functions**

Add to the end of `src/lib/markdown/citations.ts` (after the existing `applyCitations` function):

```ts
/**
 * Scans `html` for every citation bracket, in document order, expanding a
 * multi-sermon bracket into one entry per sermon — the same expansion
 * makePill already does for inline pills. No awareness of "sections": a
 * citation counts wherever it appears (inline, Quotes section, References
 * section). Call this on renderMarkdown() output, NOT raw markdown — title
 * text must already be HTML-entity-escaped, matching makeSinglePill's
 * existing escaping assumption (see its docstring above).
 */
export function extractOrderedCitations(html: string): CitationEntry[] {
  const entries: CitationEntry[] = [];
  const re = new RegExp(CITATION_RE.source, CITATION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    entries.push(...parseCitationReferences(match[1]));
  }
  return entries;
}

function citationKey(entry: CitationEntry): string {
  const ranges = entry.ranges
    .map((r) => `${r.paragraph_start}-${r.paragraph_end ?? ""}`)
    .join(",");
  return `${entry.date_id}|${ranges}`;
}

/**
 * Keeps the first occurrence of each exact citation (same date_id AND same
 * paragraph range) and drops later duplicates. Two citations of the same
 * sermon with different ranges are NOT duplicates of each other.
 */
export function dedupeCitations(entries: CitationEntry[]): CitationEntry[] {
  const seen = new Set<string>();
  const result: CitationEntry[] = [];
  for (const entry of entries) {
    const key = citationKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/**
 * Renders a deduped, ordered citation list as one clickable pill per row —
 * used by the chat window's "Sermon Quotes" view. Reuses the single-pill
 * builder, so each row carries the same .citation-pill--clickable class and
 * data-references JSON payload ReferencePopover's delegated click listener
 * already handles — no new click-handling code needed.
 */
export function renderCitationList(entries: CitationEntry[]): string {
  return entries
    .map((entry) => `<div class="raw-reference-row">${makeSinglePill(entry)}</div>`)
    .join("");
}
```

- [ ] **Step 5: Run the verification script again and confirm it passes**

Run: `npx tsx src/lib/markdown/__verify_citations.ts`
Expected: prints `citations.ts verification: OK` with no thrown assertion.

- [ ] **Step 6: Delete the throwaway script and lint**

```bash
rm src/lib/markdown/__verify_citations.ts
npm run lint
```

Expected: lint passes clean on `citations.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/markdown/citations.ts
git commit -m "feat: add citation extraction, dedup, and list rendering for raw view"
```

---

## Task 2: Shared type and i18n strings

**Files:**
- Modify: `src/lib/chat/types.ts`
- Modify: `src/lib/i18n/chatStrings.ts`

**Interfaces:**
- Produces: `export type AnswerViewMode = "full" | "quotes";` from `@/lib/chat/types` — consumed by Tasks 3–7. Three new keys on `ChatStrings` (`answerViewFullLabel`, `answerViewQuotesLabel`, `answerViewQuotesEmpty`) on all three language blocks — consumed by Tasks 3, 6, 7.

- [ ] **Step 1: Add the shared type**

In `src/lib/chat/types.ts`, add after the existing `StreamingStatus` type:

```ts
export type AnswerViewMode = "full" | "quotes";
```

- [ ] **Step 2: Add the three i18n keys to all three languages**

In `src/lib/i18n/chatStrings.ts`, add these keys to each of the `en`, `es`, `fr` blocks — placed near `chatTab`/`passagesTab` since they're the same kind of chat-chrome label:

English block (add after `passagesTab: "Passages",`):
```ts
    answerViewFullLabel: "Full Answer",
    answerViewQuotesLabel: "Sermon Quotes",
    answerViewQuotesEmpty: "No sermon quotes cited in this answer.",
```

Spanish block (add after `passagesTab: "Pasajes",`):
```ts
    answerViewFullLabel: "Respuesta completa",
    answerViewQuotesLabel: "Citas del sermón",
    answerViewQuotesEmpty: "No se citaron citas de sermones en esta respuesta.",
```

French block (add after `passagesTab: "Passages",`):
```ts
    answerViewFullLabel: "Réponse complète",
    answerViewQuotesLabel: "Citations du sermon",
    answerViewQuotesEmpty: "Aucune citation de sermon dans cette réponse.",
```

- [ ] **Step 3: Verify with the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: no new errors. Since `ChatStrings` is derived via `typeof CHAT_STRINGS[ChatLang]`, a missing key in any one language block would surface as a type error wherever `ChatStrings` is used with strict indexing — but since we're only *adding* keys uniformly to all three blocks, this should pass with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat/types.ts src/lib/i18n/chatStrings.ts
git commit -m "feat: add AnswerViewMode type and answer-view i18n strings"
```

---

## Task 3: `AnswerViewToggle` component

**Files:**
- Create: `src/components/chat/AnswerViewToggle.tsx`

**Interfaces:**
- Consumes: `AnswerViewMode` from `@/lib/chat/types` (Task 2).
- Produces: `export function AnswerViewToggle(props: { mode: AnswerViewMode; onChange: (mode: AnswerViewMode) => void; fullLabel: string; quotesLabel: string }): JSX.Element` — consumed by Task 6 (`ChatPanel`).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { AnswerViewMode } from "@/lib/chat/types";

interface AnswerViewToggleProps {
  mode: AnswerViewMode;
  onChange: (mode: AnswerViewMode) => void;
  fullLabel: string;
  quotesLabel: string;
}

function segmentClassName(active: boolean): string {
  return `rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
    active
      ? "bg-white text-foreground shadow-sm dark:bg-zinc-700"
      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`;
}

export function AnswerViewToggle({
  mode,
  onChange,
  fullLabel,
  quotesLabel,
}: AnswerViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Answer view"
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "full"}
        onClick={() => onChange("full")}
        className={segmentClassName(mode === "full")}
      >
        {fullLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "quotes"}
        onClick={() => onChange("quotes")}
        className={segmentClassName(mode === "quotes")}
      >
        {quotesLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean. (No manual render check yet — this component has no host until Task 6 wires it into `ChatPanel`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/AnswerViewToggle.tsx
git commit -m "feat: add AnswerViewToggle segmented control component"
```

---

## Task 4: `MessageBubble` mode branching

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

**Interfaces:**
- Consumes: `extractOrderedCitations`, `dedupeCitations`, `renderCitationList` from `@/lib/markdown/citations` (Task 1); `AnswerViewMode` from `@/lib/chat/types` (Task 2).
- Produces: `MessageBubble` gains two new optional props, `mode?: AnswerViewMode` (default `"full"`) and `quotesEmptyText?: string` (default a hardcoded English fallback) — consumed by Task 5 (`MessageList`). Default values mean this task, on its own, changes nothing about current rendering — `SharePageShell`'s existing call site (which doesn't pass these props) is provably unaffected.

- [ ] **Step 1: Update imports and props**

In `src/components/chat/MessageBubble.tsx`, change the imports at the top:

```ts
"use client";

import { useMemo } from "react";
import type { Message, AnswerViewMode } from "@/lib/chat/types";
import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  stripParagraphLetterSuffixes,
  extractOrderedCitations,
  dedupeCitations,
  renderCitationList,
} from "@/lib/markdown/citations";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

interface MessageBubbleProps {
  message: Message;
  mode?: AnswerViewMode;
  quotesEmptyText?: string;
}
```

- [ ] **Step 2: Branch the render memo**

Replace the `MessageBubble` function's opening (the `renderedHtml` memo) with:

```tsx
export function MessageBubble({
  message,
  mode = "full",
  quotesEmptyText = "No sermon quotes cited in this answer.",
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Memoize the full render pipeline for assistant messages.
  // Messages are immutable once added, so this only runs once per message
  // per mode.
  const renderedHtml = useMemo(() => {
    if (isUser) return "";
    // stripAnswerPrefix at render time catches historical DB messages saved before dedup existed
    // stripParagraphLetterSuffixes at render catches historical messages; new ones are normalized before save
    const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(message.content));
    const processed = postprocessChatResponse(cleaned);
    const html = renderMarkdown(processed);

    if (mode === "quotes") {
      const entries = dedupeCitations(extractOrderedCitations(html));
      if (entries.length === 0) {
        return `<p class="answer-view-empty">${quotesEmptyText}</p>`;
      }
      return renderCitationList(entries);
    }

    return applyCitations(html);
  }, [isUser, message.content, mode, quotesEmptyText]);
```

Leave the rest of the function (the `isUser` early return JSX, and the assistant-message return JSX using `renderedHtml`) exactly as it is today — no other changes.

- [ ] **Step 3: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean. `SharePageShell`'s call site doesn't pass `mode`/`quotesEmptyText`, so it uses the defaults (`"full"`, the hardcoded fallback) — behaviorally identical to before this task.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat: branch MessageBubble render on AnswerViewMode"
```

---

## Task 5: `MessageList` prop threading

**Files:**
- Modify: `src/components/chat/MessageList.tsx`

**Interfaces:**
- Consumes: `AnswerViewMode` from `@/lib/chat/types` (Task 2); the updated `MessageBubble` props (Task 4).
- Produces: `MessageList` gains two new optional props, `mode?: AnswerViewMode` and `quotesEmptyText?: string`, passed straight through to every `MessageBubble` it renders — consumed by Task 6 (`ChatPanel`). `StreamingText` (the in-progress message) does **not** receive either prop — unaffected by design (spec: streaming always shows live text regardless of mode).

- [ ] **Step 1: Update the props interface and import**

```ts
import type { Message, StreamingStatus, AnswerViewMode } from "@/lib/chat/types";
```

```ts
interface MessageListProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  finalizingText?: string;
  mode?: AnswerViewMode;
  quotesEmptyText?: string;
}
```

- [ ] **Step 2: Thread the props through to `MessageBubble`**

```tsx
export function MessageList({
  messages,
  streamingStatus,
  streamBuffer,
  finalizingText,
  mode,
  quotesEmptyText,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamBuffer, streamingStatus]);

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6 xl:max-w-[56rem]"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          mode={mode}
          quotesEmptyText={quotesEmptyText}
        />
      ))}

      {streamingStatus === "streaming" && streamBuffer && (
        <StreamingText content={streamBuffer} />
      )}

      <StreamingIndicator status={streamingStatus} finalizingText={finalizingText} />
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
```

(Only the props interface, the function signature, and the `MessageBubble` JSX call change — `StreamingIndicator` and `StreamingText` definitions above are untouched.)

- [ ] **Step 3: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/MessageList.tsx
git commit -m "feat: thread AnswerViewMode through MessageList"
```

---

## Task 6: `ChatPanel` header + toggle mount

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`

**Interfaces:**
- Consumes: `AnswerViewToggle` (Task 3); `AnswerViewMode` from `@/lib/chat/types` (Task 2); updated `MessageList` props (Task 5).
- Produces: `ChatPanel` gains five new required props: `mode: AnswerViewMode`, `onModeChange: (mode: AnswerViewMode) => void`, `answerViewFullLabel: string`, `answerViewQuotesLabel: string`, `answerViewQuotesEmpty: string` — consumed by Task 7 (`ChatShell`, both instances).

- [ ] **Step 1: Update imports and props interface**

```ts
"use client";

import Image from "next/image";
import type { Message, StreamingStatus, AnswerViewMode } from "@/lib/chat/types";
import { MessageList } from "./MessageList";
import { AnswerViewToggle } from "./AnswerViewToggle";
import logo from "../../../logo.png";

interface ChatPanelProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  error: string | null;
  isLoading?: boolean;
  welcomeDescription: string;
  finalizingText: string;
  mode: AnswerViewMode;
  onModeChange: (mode: AnswerViewMode) => void;
  answerViewFullLabel: string;
  answerViewQuotesLabel: string;
  answerViewQuotesEmpty: string;
}
```

- [ ] **Step 2: Make the header always-visible and mount the toggle**

Replace the component body's header + `MessageList` usage:

```tsx
export function ChatPanel({
  messages,
  streamingStatus,
  streamBuffer,
  error,
  isLoading,
  welcomeDescription,
  finalizingText,
  mode,
  onModeChange,
  answerViewFullLabel,
  answerViewQuotesLabel,
  answerViewQuotesEmpty,
}: ChatPanelProps) {
  const isEmpty =
    messages.length === 0 && streamingStatus === "idle" && !isLoading;

  return (
    <div className="flex h-full flex-col bg-[var(--surface-chat)]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase lg:hidden dark:text-zinc-400">
          Chat
        </h2>
        <AnswerViewToggle
          mode={mode}
          onChange={onModeChange}
          fullLabel={answerViewFullLabel}
          quotesLabel={answerViewQuotesLabel}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : isEmpty ? (
          <WelcomeState description={welcomeDescription} />
        ) : (
          <MessageList
            messages={messages}
            streamingStatus={streamingStatus}
            streamBuffer={streamBuffer}
            finalizingText={finalizingText}
            mode={mode}
            quotesEmptyText={answerViewQuotesEmpty}
          />
        )}
      </div>

      {error && <ErrorBanner error={error} />}
    </div>
  );
}
```

Note the header strip's wrapping `div` loses `lg:hidden` (now always visible on both viewports) — only the "Chat" `<h2>` label keeps `lg:hidden` (mobile-only text, matching current mobile appearance). The toggle now shows on both viewports; `justify-between` right-aligns it against the label when the label is present (mobile) and simply right-aligns it alone when the label is hidden (desktop, since it's the only flex child).

`WelcomeState`, `ErrorBanner`, `LoadingState` function definitions above are untouched.

- [ ] **Step 3: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both fail until Task 7 updates `ChatShell`'s two `<ChatPanel>` call sites to pass the five new required props — this is expected at this point in isolation. If you're executing tasks strictly in order, proceed to Task 7 before attempting to run the app.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat: make ChatPanel header always-visible and mount AnswerViewToggle"
```

---

## Task 7: `ChatShell` state, persistence, and full wiring

**Files:**
- Modify: `src/components/chat/ChatShell.tsx`

**Interfaces:**
- Consumes: `AnswerViewMode` from `@/lib/chat/types` (Task 2); updated `ChatPanel` props (Task 6).
- Produces: nothing new for later tasks — this is the final integration point.

- [ ] **Step 1: Add the type import**

Update the existing type import near the top of `src/components/chat/ChatShell.tsx`:

```ts
import type {
  Message,
  RagData,
  StreamingStatus,
  Conversation,
  AnswerViewMode,
} from "@/lib/chat/types";
```

- [ ] **Step 2: Add the sessionStorage key and getter, alongside the existing mobile-tab ones**

Near the top of the file, next to `MOBILE_ACTIVE_TAB_KEY` and `getStoredMobileTab`:

```ts
const ANSWER_VIEW_MODE_KEY = "branham-answer-view-mode";

function getStoredAnswerViewMode(): AnswerViewMode {
  if (typeof window === "undefined") return "full";
  const stored = window.sessionStorage.getItem(ANSWER_VIEW_MODE_KEY);
  return stored === "full" || stored === "quotes" ? stored : "full";
}
```

- [ ] **Step 3: Add state and the change handler**

Near the other UI state declarations (next to `activeTab`/`sidebarCollapsed`):

```ts
const [answerViewMode, setAnswerViewMode] = useState<AnswerViewMode>(
  getStoredAnswerViewMode,
);
```

Near the other `useCallback` handlers (a good spot is right after `handleTabChange`):

```ts
const handleAnswerViewModeChange = useCallback((mode: AnswerViewMode) => {
  setAnswerViewMode(mode);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(ANSWER_VIEW_MODE_KEY, mode);
  }
}, []);
```

- [ ] **Step 4: Pass the new props into both `<ChatPanel>` instances**

There are exactly two `<ChatPanel>` JSX call sites in this file — one inside the `hidden ... lg:flex` desktop two-panel block, one inside the `lg:hidden` mobile sliding-tab block. Add the same five props to **both**:

```tsx
<ChatPanel
  messages={messages}
  streamingStatus={streamingStatus}
  streamBuffer={streamBuffer}
  error={error}
  isLoading={conversationLoading}
  welcomeDescription={strings.welcomeDescription}
  finalizingText={strings.finalizingResponse}
  mode={answerViewMode}
  onModeChange={handleAnswerViewModeChange}
  answerViewFullLabel={strings.answerViewFullLabel}
  answerViewQuotesLabel={strings.answerViewQuotesLabel}
  answerViewQuotesEmpty={strings.answerViewQuotesEmpty}
/>
```

- [ ] **Step 5: Lint and type-check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: both pass clean now that both `ChatPanel` call sites supply the required props.

- [ ] **Step 6: Manual QA in the browser**

Run `npm run dev`, then in a browser at `http://localhost:3000/chat` (log in or continue as a guest), walk through the full checklist from the spec's Testing section:

- Ask a question, wait for the answer to complete. Toggle to "Sermon Quotes" — confirm the assistant message switches to a stacked list of clickable pills, in the order they were cited (compare against the "Full Answer" view's inline citations).
- Ask a second question in the same conversation. Confirm toggling switches **both** answers at once (global, not per-message).
- Click a pill in "Sermon Quotes" mode — confirm `ReferencePopover` opens with the correct sermon excerpt, identical to clicking an inline pill in "Full Answer" mode.
- Find or construct a question whose answer cites the same sermon twice with different paragraph ranges — confirm both rows survive in "Sermon Quotes" mode.
- Ask a question whose answer likely has no citations (e.g., an off-topic or clarifying question) — confirm the "No sermon quotes cited in this answer." empty state renders instead of a blank area.
- While a new answer is actively streaming with "Sermon Quotes" mode active, confirm it still renders live streaming text (not a references list) until it completes, then snaps to the reference list on completion.
- Resize the browser across the `1024px` breakpoint (or use device toolbar to switch mobile/desktop) — confirm the toggle's state stays in sync between the two `ChatPanel` instances.
- Reload the page (same tab) — confirm the previously selected mode persists (sessionStorage).
- Open a public share link (`/share/[hash]`) for any previously shared conversation — confirm there is no toggle and the page renders exactly as it did before this feature (still "Full Answer" style, unconditionally).

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ChatShell.tsx
git commit -m "feat: wire AnswerViewMode state and persistence into ChatShell"
```

---

## Self-Review Notes

- **Spec coverage:** Toggle scope (global) → Task 7. Dedup key/scope → Task 1. User messages unaffected → Task 4 (mode only branches the `!isUser` path; `isUser` early-return is untouched). Streaming behavior → Task 5 (`StreamingText` doesn't receive `mode`). Persistence → Task 7 Step 2–3. Share-page out of scope → Task 4 Step 1 default values + Task 7 QA checklist's last bullet. Labels → Task 2. All spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an explicit shell command.
- **Type consistency:** `AnswerViewMode` defined once in Task 2, imported verbatim (`AnswerViewMode`) in Tasks 3–7 — no renaming across tasks. `CitationEntry` defined once in Task 1, consumed by name in Task 4. Prop names (`mode`, `onModeChange`, `answerViewFullLabel`, `answerViewQuotesLabel`, `answerViewQuotesEmpty`, `quotesEmptyText`) are consistent from their producing task through to their consuming task.
