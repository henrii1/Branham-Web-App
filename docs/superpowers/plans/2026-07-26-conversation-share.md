# Conversation Share Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user share a conversation via a public read-only `/share/[hash]` link and a downloadable image card, with a login-gated continue flow that forks non-owners into their own conversation.

**Architecture:** One new Supabase table (`conversation_shares`) with RLS policies that make a shared conversation's `conversations`/`chat_messages` rows publicly `select`-able (never writable) via a random hash. A Share action in the existing conversation-sidebar dropdown creates a share row and opens a modal with the link + a client-generated PNG card. New `/share/[hash]` and `/[lang]/share/[hash]` server-rendered routes read the shared rows through the public RLS policy and render them read-only, reusing `MessageBubble`. Continuing forks the visible messages + pinned RAG/summary snapshot into a brand-new conversation owned by the visitor, using the same create/save/upsert/update sequence `SeoShell.handleFollowUp` already uses for the anonymous→signed-up handoff.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), `@supabase/ssr` browser/server clients, `html-to-image` (new) for client-side PNG rendering.

## Global Constraints

- No automated test framework exists in this repo (no Jest/Vitest/`@playwright/test` — confirmed absent from `package.json`). Per explicit user decision, every task is verified manually: the Playwright MCP browser tool for UI-facing behavior, direct SQL for DB-only changes, and `npm run lint` + `npx tsc --noEmit` for every code change. This mirrors the repo's existing manual-screenshot verification convention (see `verify-*.png` / `lang-test-*.png` files already in the working tree from prior i18n work).
- Card generation must dynamically `import("html-to-image")` at the point of use (inside the Download click handler), never at module top-level — per this project's latency-first constraint (no added weight on initial page load) recorded in project memory.
- Locale routing: English is unprefixed (`/share/[hash]`); `SUPPORTED_LANGS = ["es", "fr"] as const` gates `/[lang]/share/[hash]`, exactly mirroring the existing local const in `src/app/[lang]/q/[slug]/page.tsx` (this is intentionally **not** the same as the app-wide `SUPPORTED_LANGUAGES` in `src/lib/constants/languages.ts`, which includes `"en"`).
- Migration numbering: next file is `supabase/migrations/007_conversation_shares.sql` (repo uses zero-padded 3-digit sequence numbers, not timestamps — last is `006_seo_cache_composite_pk.sql`). There is no `npm run` script for migrations; the documented convention is `npx supabase db push` (Supabase CLI, per `.cursor/rules/design_spec.md`).
- `share_hash` is generated client-side via `crypto.randomUUID().replace(/-/g, "")` (32 hex chars, 128 bits of randomness) — no new dependency (e.g. nanoid) is needed for this.
- `MessageBubble` (`src/components/chat/MessageBubble.tsx`) is reused as-is on the read-only share page — it is pure/presentational with no click handlers of its own. Citation-pill click behavior comes from mounting `<ReferencePopover />` alongside it, exactly as `ChatShell`/`SeoShell` already do.
- The `seoSlug` prop on `LoginModal` only affects the `?seo_slug=` query string on the signup/login links, which no downstream route currently consumes — the actual anonymous→signed-up handoff works purely through a localStorage key (`pending_seo_slug`) that `ChatShell`'s init effect reads after the user lands back on `/chat` post-auth (confirmed: `onboarding/language/page.tsx` defaults `redirectTo` to `/chat`). The share continue-flow reuses only that localStorage mechanism (`pending_share_hash`) — it does **not** need a new `LoginModal` prop.
- Card background images: the spec calls for 3 user-supplied nature-photo/logo-watermark PNGs, which do not exist in this repo yet. This plan ships 3 CSS-gradient placeholders (matching the existing `src/app/opengraph-image.tsx` gradient aesthetic) behind the same `SHARE_CARD_BACKGROUNDS` list the real assets will eventually populate — swapping in real photos later is a one-line `css` → `url(...)` change per entry, not a re-plan.

---

## File Structure

```
supabase/migrations/007_conversation_shares.sql   [new]  table + RLS

src/lib/utils/ids.ts                              [modify] + generateShareHash()
src/lib/db/queries.ts                             [modify] + createShare()
src/lib/db/share-queries.ts                       [new]  public/server reads: fetchShareByHash, fetchSharedConversation, fetchSharedMessages
src/lib/chat/forkFromShare.ts                      [new]  forkConversationFromShare() — shared by SharePageShell + ChatShell
src/lib/share/cardBackgrounds.ts                   [new]  SHARE_CARD_BACKGROUNDS placeholder list
src/lib/share/generateShareCard.ts                 [new]  renderCardToPng() — dynamic html-to-image import
src/lib/i18n/chatStrings.ts                        [modify] + share.* strings (en/es/fr)

src/components/chat/ConversationSidebar.tsx        [modify] + Share menu entry
src/components/chat/ShareModal.tsx                 [new]  link/copy + background picker + download
src/components/chat/ShareCardTemplate.tsx           [new]  off-screen 1200x630 DOM node captured by html-to-image
src/components/chat/ChatShell.tsx                  [modify] handleShareConversation, ShareModal mount, pending_share_hash fork branch
src/components/seo/SeoShell.tsx                    [modify] handleShareConversation, ShareModal mount (mirrors ChatShell)
src/components/share/SharePageShell.tsx             [new]  read-only conversation view + continue button

src/app/share/[hash]/page.tsx                       [new]  EN share route
src/app/[lang]/share/[hash]/page.tsx                [new]  ES/FR share route

package.json                                       [modify] + html-to-image dependency
```

Note: no `globals.css` changes are needed — `ShareModal`/`SharePageShell` are styled entirely with existing Tailwind utility classes, and the off-screen `ShareCardTemplate` node inherits the existing `.citation-pill` global CSS automatically since it renders in the same document.

---

### Task 1: `conversation_shares` table + RLS

**Files:**
- Create: `supabase/migrations/007_conversation_shares.sql`

**Interfaces:**
- Produces: table `public.conversation_shares(id, share_hash, conversation_id, owner_id, language, cutoff_created_at, rag_context_snapshot, retrieval_query_snapshot, retrieval_metadata_snapshot, conversation_summary_snapshot, created_at)` and two new public `select` policies on `conversations`/`chat_messages` — every later task's queries depend on these exact column names.

- [ ] **Step 1: Write the migration**

```sql
-- conversation_shares: public read-only share links for conversations.
-- Each Share click inserts a new row (new hash); rows are immutable —
-- no update/delete policy, so the only removal path is the cascade from
-- deleting the source conversation. RAG context is pinned here (not
-- read live from conversation_rag) because conversation_rag is
-- upserted latest-only and would otherwise be overwritten by a later
-- turn on the same conversation.

create table public.conversation_shares (
  id                            uuid primary key default gen_random_uuid(),
  share_hash                    text unique not null,
  conversation_id               uuid not null references public.conversations(id) on delete cascade,
  owner_id                      uuid not null references auth.users(id),
  language                      text not null,
  cutoff_created_at             timestamptz not null,
  rag_context_snapshot          text,
  retrieval_query_snapshot      text,
  retrieval_metadata_snapshot   jsonb,
  conversation_summary_snapshot text,
  created_at                    timestamptz not null default now()
);

create index conversation_shares_conversation_id_idx
  on public.conversation_shares (conversation_id);

create index conversation_shares_share_hash_idx
  on public.conversation_shares (share_hash);

alter table public.conversation_shares enable row level security;

create policy "Anyone can read shares"
  on public.conversation_shares for select
  using (true);

create policy "Owners can create shares of their own conversations"
  on public.conversation_shares for insert
  with check (
    owner_id = auth.uid()
    and conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- No update/delete policy: rows are immutable; removal only happens via
-- the ON DELETE CASCADE from the parent conversation.

-- Extend conversations/chat_messages so a shared conversation becomes
-- publicly readable (never writable) by anyone holding a valid share
-- hash. Postgres OR's multiple permissive `select` policies together,
-- so these compose with the existing owner-only select policies rather
-- than replacing them.

create policy "Anyone can view shared conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_shares s
      where s.conversation_id = conversations.id
    )
  );

create policy "Anyone can view shared messages"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.conversation_shares s
      where s.conversation_id = chat_messages.conversation_id
        and chat_messages.created_at <= s.cutoff_created_at
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: CLI reports `007_conversation_shares.sql` applied with no errors.

- [ ] **Step 3: Verify table + RLS via SQL**

Run in the Supabase SQL editor (or `npx supabase db execute --sql "..."`):

```sql
select polname, cmd, permissive from pg_policies where tablename = 'conversation_shares' order by polname;
select polname from pg_policies where tablename in ('conversations','chat_messages') order by tablename, polname;
```

Expected: `conversation_shares` shows exactly 2 policies (`select`/`true`, `insert`/owner-check). `conversations` and `chat_messages` each show their original owner-only policies **plus** the new `"Anyone can view shared ..."` select policy.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_conversation_shares.sql
git commit -m "feat(share): add conversation_shares table + public-read RLS"
```

---

### Task 2: `generateShareHash`

**Files:**
- Modify: `src/lib/utils/ids.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateShareHash(): string` — a 32-char lowercase hex token, used by Task 3's `createShare` caller (`ChatShell.handleShareConversation`, Task 6).

- [ ] **Step 1: Add the function**

```ts
export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShareHash(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
```

- [ ] **Step 2: Verify manually**

Run: `npx tsx -e "import('./src/lib/utils/ids.ts').then(m => { const a = m.generateShareHash(); const b = m.generateShareHash(); console.log(a, a.length, a !== b); })"`
Expected: two distinct 32-character hex strings and `true` printed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/ids.ts
git commit -m "feat(share): add generateShareHash"
```

---

### Task 3: `createShare` write helper

**Files:**
- Modify: `src/lib/db/queries.ts`

**Interfaces:**
- Consumes: `conversation_shares` table from Task 1.
- Produces: `createShare(input: NewShareInput): Promise<void>` — called by `ChatShell.handleShareConversation` (Task 6).

- [ ] **Step 1: Add the interface + function**

```ts
export interface NewShareInput {
  id: string;
  shareHash: string;
  conversationId: string;
  ownerId: string;
  language: string;
  cutoffCreatedAt: string;
  ragContextSnapshot: string | null;
  retrievalQuerySnapshot: string | null;
  retrievalMetadataSnapshot: unknown;
  conversationSummarySnapshot: string | null;
}

export async function createShare(input: NewShareInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("conversation_shares").insert({
    id: input.id,
    share_hash: input.shareHash,
    conversation_id: input.conversationId,
    owner_id: input.ownerId,
    language: input.language,
    cutoff_created_at: input.cutoffCreatedAt,
    rag_context_snapshot: input.ragContextSnapshot,
    retrieval_query_snapshot: input.retrievalQuerySnapshot,
    retrieval_metadata_snapshot: input.retrievalMetadataSnapshot,
    conversation_summary_snapshot: input.conversationSummarySnapshot,
  });

  if (error) throw error;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Behavioral verification happens in Task 6, once this is actually invoked from the UI.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries.ts
git commit -m "feat(share): add createShare query helper"
```

---

### Task 4: Public share reads (`share-queries.ts`)

**Files:**
- Create: `src/lib/db/share-queries.ts`

**Interfaces:**
- Consumes: `conversation_shares`/`conversations`/`chat_messages` public-read policies from Task 1.
- Produces: `fetchShareByHash(shareHash): Promise<ShareRow | null>`, `fetchSharedConversation(conversationId): Promise<SharedConversationRow | null>`, `fetchSharedMessages(conversationId, cutoffCreatedAt): Promise<SharedMessageRow[]>` — consumed by the share page routes (Task 7) and `forkConversationFromShare` (Task 8).

- [ ] **Step 1: Write the module**

```ts
import { createClient } from "@supabase/supabase-js";

export interface ShareRow {
  id: string;
  share_hash: string;
  conversation_id: string;
  owner_id: string;
  language: string;
  cutoff_created_at: string;
  rag_context_snapshot: string | null;
  retrieval_query_snapshot: string | null;
  retrieval_metadata_snapshot: unknown;
  conversation_summary_snapshot: string | null;
  created_at: string;
}

export interface SharedConversationRow {
  id: string;
  title: string | null;
  conversation_summary: string | null;
}

export interface SharedMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const SHARE_COLUMNS =
  "id, share_hash, conversation_id, owner_id, language, cutoff_created_at, rag_context_snapshot, retrieval_query_snapshot, retrieval_metadata_snapshot, conversation_summary_snapshot, created_at" as const;

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function fetchShareByHash(
  shareHash: string,
): Promise<ShareRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("conversation_shares")
    .select(SHARE_COLUMNS)
    .eq("share_hash", shareHash)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSharedConversation(
  conversationId: string,
): Promise<SharedConversationRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, conversation_summary")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSharedMessages(
  conversationId: string,
  cutoffCreatedAt: string,
): Promise<SharedMessageRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .lte("created_at", cutoffCreatedAt)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/share-queries.ts
git commit -m "feat(share): add public share-queries reads"
```

---

### Task 5: i18n strings

**Files:**
- Modify: `src/lib/i18n/chatStrings.ts`

**Interfaces:**
- Produces: new keys on `ChatStrings` (auto-derived via `(typeof CHAT_STRINGS)[ChatLang]`) consumed by Tasks 6, 7, 9.

- [ ] **Step 1: Add English keys** — insert after `untitledConversation: "New conversation",` (line 45):

```ts
    untitledConversation: "New conversation",
    // Share feature
    shareAction: "Share",
    shareModalTitle: "Share this conversation",
    shareLinkLabel: "Public link",
    shareCopyLink: "Copy link",
    shareCopied: "Copied!",
    shareDownloadCard: "Download image",
    shareGenerating: "Generating…",
    shareBackgroundLabel: "Background",
    shareClose: "Close",
    shareReadOnlyBanner: "This is a shared, read-only conversation.",
    shareContinueButton: "Continue this conversation",
    shareLoginToContinue: "Log in to continue this conversation",
    shareNotFoundTitle: "Share not found",
    shareNotFoundBody: "This share link is no longer available.",
```

- [ ] **Step 2: Add Spanish keys** — insert after `untitledConversation: "Nueva conversación",` (line 109 pre-edit):

```ts
    untitledConversation: "Nueva conversación",
    // Share feature
    shareAction: "Compartir",
    shareModalTitle: "Compartir esta conversación",
    shareLinkLabel: "Enlace público",
    shareCopyLink: "Copiar enlace",
    shareCopied: "¡Copiado!",
    shareDownloadCard: "Descargar imagen",
    shareGenerating: "Generando…",
    shareBackgroundLabel: "Fondo",
    shareClose: "Cerrar",
    shareReadOnlyBanner: "Esta es una conversación compartida de solo lectura.",
    shareContinueButton: "Continuar esta conversación",
    shareLoginToContinue: "Inicia sesión para continuar esta conversación",
    shareNotFoundTitle: "Enlace no encontrado",
    shareNotFoundBody: "Este enlace para compartir ya no está disponible.",
```

- [ ] **Step 3: Add French keys** — insert after `untitledConversation: "Nouvelle conversation",` (line 173 pre-edit):

```ts
    untitledConversation: "Nouvelle conversation",
    // Share feature
    shareAction: "Partager",
    shareModalTitle: "Partager cette conversation",
    shareLinkLabel: "Lien public",
    shareCopyLink: "Copier le lien",
    shareCopied: "Copié !",
    shareDownloadCard: "Télécharger l'image",
    shareGenerating: "Génération…",
    shareBackgroundLabel: "Arrière-plan",
    shareClose: "Fermer",
    shareReadOnlyBanner: "Ceci est une conversation partagée en lecture seule.",
    shareContinueButton: "Continuer cette conversation",
    shareLoginToContinue: "Connectez-vous pour continuer cette conversation",
    shareNotFoundTitle: "Lien introuvable",
    shareNotFoundBody: "Ce lien de partage n'est plus disponible.",
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (all three language objects must have identical key sets, or the `ChatStrings` union type will surface a mismatch here).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/chatStrings.ts
git commit -m "feat(share): add share-feature i18n strings (en/es/fr)"
```

---

### Task 6: Share entry point (sidebar menu + modal + create-share wiring)

**Files:**
- Modify: `src/components/chat/ConversationSidebar.tsx`
- Create: `src/components/chat/ShareModal.tsx`
- Modify: `src/components/chat/ChatShell.tsx`
- Modify: `src/components/seo/SeoShell.tsx`

**Interfaces:**
- Consumes: `createShare` (Task 3), `generateShareHash` (Task 2), `strings.share*` (Task 5).
- Produces: `ConversationSidebarProps.onShareConversation: (id: string) => void`; `<ShareModal onClose strings shareUrl />` — the `shareUrl` prop and `ShareModal` import path are what Task 9 extends with a download section.

- [ ] **Step 1: Add the Share entry to `ConversationSidebar.tsx`**

Add to `ConversationSidebarProps` (after `onDeleteConversation`):
```ts
  onShareConversation: (id: string) => void;
```

Add to `ConversationItemProps` (after `onDelete`):
```ts
  onShare: () => void;
```

Destructure `onShare` in `ConversationItem({ conv, isActive, onSelect, onRename, onDelete, onShare, onClose, strings })`.

Add a Share button above the existing Rename button in the non-`confirmingDelete` dropdown branch:
```tsx
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onShare();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.769-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                    />
                  </svg>
                  {strings.shareAction}
                </button>
```

In the main `ConversationSidebar` component, destructure `onShareConversation` alongside `onRenameConversation`/`onDeleteConversation`, and at the `<ConversationItem>` call site add:
```tsx
                    onShare={() => onShareConversation(conv.id)}
```

- [ ] **Step 2: Write `ShareModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface ShareModalProps {
  onClose: () => void;
  strings: ChatStrings;
  shareUrl: string;
}

export function ShareModal({ onClose, strings, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {strings.shareModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.shareClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareLinkLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? strings.shareCopied : strings.shareCopyLink}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `ChatShell.tsx`**

Add `createShare` to the existing `@/lib/db/queries` import (line 13-27) and `generateShareHash` to the existing `@/lib/utils/ids` import (line 7):
```ts
import { generateId, generateShareHash } from "@/lib/utils/ids";
```
```ts
import {
  fetchConversations,
  fetchConversation,
  fetchMessages,
  fetchLatestRag,
  fetchUserLanguage,
  updateUserLanguage,
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
  renameConversation,
  deleteConversation,
  fetchSeoPageClient,
  createShare,
} from "@/lib/db/queries";
```
Add the import:
```ts
import { ShareModal } from "./ShareModal";
```

Add state near the other modal state (`showLoginModal`, line ~155):
```ts
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
```

Add the handler near `handleDeleteConversation` (~line 976):
```ts
  // ── Share conversation ──────────────────────────────────────────────
  const handleShareConversation = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const [msgs, rag, conv] = await Promise.all([
          fetchMessages(id),
          fetchLatestRag(id),
          fetchConversation(id),
        ]);
        if (msgs.length === 0) return;
        const cutoff = msgs[msgs.length - 1].created_at;
        const shareHash = generateShareHash();
        await createShare({
          id: generateId(),
          shareHash,
          conversationId: id,
          ownerId: user.id,
          language: chatLanguage,
          cutoffCreatedAt: cutoff,
          ragContextSnapshot: rag?.rag_context ?? null,
          retrievalQuerySnapshot: rag?.retrieval_query ?? null,
          retrievalMetadataSnapshot: rag?.retrieval_metadata ?? null,
          conversationSummarySnapshot: conv?.conversation_summary ?? null,
        });
        const path =
          chatLanguage === "en" ? `/share/${shareHash}` : `/${chatLanguage}/share/${shareHash}`;
        setShareModalUrl(`${window.location.origin}${path}`);
      } catch (err) {
        console.error("Failed to create share:", err);
      }
    },
    [user, chatLanguage],
  );
```

Wire the prop at both `<ConversationSidebar>` call sites (~line 1052-1053 and ~1100-1101), next to `onDeleteConversation`:
```tsx
            onShareConversation={handleShareConversation}
```

Mount the modal near the existing `{showLoginModal && (...)}` block (~line 1290):
```tsx
      {shareModalUrl && (
        <ShareModal
          onClose={() => setShareModalUrl(null)}
          strings={strings}
          shareUrl={shareModalUrl}
        />
      )}
```

- [ ] **Step 4: Mirror the wiring in `SeoShell.tsx`**

Repeat the same import additions, `shareModalUrl` state, `handleShareConversation` handler (adjust to whatever local variable name `SeoShell` uses for the active `language`), `<ShareModal>` mount, and `onShareConversation={handleShareConversation}` at both `<ConversationSidebar>` call sites (desktop ~line 421, mobile drawer ~line 467), mirroring exactly how `handleRenameConversation`/`handleDeleteConversation` are already duplicated between the two files.

- [ ] **Step 5: Verify with Playwright MCP**

1. `npm run dev`, navigate to `http://localhost:3000/chat` and log in.
2. Send a message so a conversation with at least one assistant reply exists.
3. Open the sidebar's three-dot menu on that conversation, click **Share**.
4. Assert (via `browser_snapshot`) the modal shows a `shareModalTitle` heading and an input containing a URL matching `/share/[32 hex chars]`.
5. Click **Copy link**, assert the button label changes to "Copied!".
6. Run a SQL check: `select share_hash, conversation_id, owner_id from conversation_shares order by created_at desc limit 1;` — confirm the hash matches what was shown in the modal and `conversation_id`/`owner_id` match the tested conversation/user.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ConversationSidebar.tsx src/components/chat/ShareModal.tsx src/components/chat/ChatShell.tsx src/components/seo/SeoShell.tsx
git commit -m "feat(share): add Share action, modal, and share-row creation"
```

---

### Task 7: Public share page (read-only)

**Files:**
- Create: `src/components/share/SharePageShell.tsx`
- Create: `src/app/share/[hash]/page.tsx`
- Create: `src/app/[lang]/share/[hash]/page.tsx`

**Interfaces:**
- Consumes: `fetchShareByHash`, `fetchSharedConversation`, `fetchSharedMessages` (Task 4); `MessageBubble`, `ReferencePopover` (existing); `strings.share*` (Task 5).
- Produces: `<SharePageShell conversationId shareHash title messages isOwner language strings />` — the `handleContinue` non-owner-logged-in branch is a stub in this task (`// TODO forked in Task 8` is **not acceptable** per plan rules, so instead: it silently does nothing and is completed in Task 8, which is documented here as a known, temporary gap — the owner and anonymous branches are fully functional after this task).

- [ ] **Step 1: Write `SharePageShell.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthGate";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ReferencePopover } from "@/components/chat/ReferencePopover";
import { LoginModal } from "@/components/chat/LoginModal";
import type { Message } from "@/lib/chat/types";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface SharePageShellProps {
  conversationId: string;
  shareHash: string;
  title: string | null;
  messages: Message[];
  isOwner: boolean;
  language: string;
  strings: ChatStrings;
}

export function SharePageShell({
  conversationId,
  shareHash,
  title,
  messages,
  isOwner,
  language: _language,
  strings,
}: SharePageShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);

  function handleContinue() {
    if (isOwner) {
      router.push(`/chat/${conversationId}`);
      return;
    }
    if (!user) {
      localStorage.setItem("pending_share_hash", shareHash);
      setShowLoginModal(true);
    }
    // Logged-in, non-owner fork is wired in a later task.
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8">
      <div className="mb-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {strings.shareReadOnlyBanner}
      </div>
      {title && (
        <h1 className="mb-6 text-xl font-semibold text-foreground">{title}</h1>
      )}
      <div className="flex flex-1 flex-col gap-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isOwner ? strings.shareContinueButton : strings.shareLoginToContinue}
        </button>
      </div>
      <ReferencePopover />
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/share/[hash]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchShareByHash,
  fetchSharedConversation,
  fetchSharedMessages,
} from "@/lib/db/share-queries";
import { createClient } from "@/lib/supabase/server";
import { SharePageShell } from "@/components/share/SharePageShell";
import { getChatStrings } from "@/lib/i18n/chatStrings";
import type { Message } from "@/lib/chat/types";

const SITE_URL = "https://branhamsermons.ai";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  const share = await fetchShareByHash(hash);
  if (!share) return { title: "Not Found" };
  const conversation = await fetchSharedConversation(share.conversation_id);
  const title = conversation?.title ?? "Shared conversation";
  return {
    title: `${title} — Branham Sermons Assistant`,
    alternates: { canonical: `${SITE_URL}/share/${hash}` },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const share = await fetchShareByHash(hash);
  if (!share || share.language !== "en") notFound();

  const [conversation, messageRows] = await Promise.all([
    fetchSharedConversation(share.conversation_id),
    fetchSharedMessages(share.conversation_id, share.cutoff_created_at),
  ]);
  if (!conversation || messageRows.length === 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === share.owner_id;

  const messages: Message[] = messageRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <SharePageShell
      conversationId={share.conversation_id}
      shareHash={hash}
      title={conversation.title}
      messages={messages}
      isOwner={isOwner}
      language="en"
      strings={getChatStrings("en")}
    />
  );
}
```

- [ ] **Step 3: Write `src/app/[lang]/share/[hash]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchShareByHash,
  fetchSharedConversation,
  fetchSharedMessages,
} from "@/lib/db/share-queries";
import { createClient } from "@/lib/supabase/server";
import { SharePageShell } from "@/components/share/SharePageShell";
import { getChatStrings } from "@/lib/i18n/chatStrings";
import type { Message } from "@/lib/chat/types";

const SITE_URL = "https://branhamsermons.ai";
const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; hash: string }>;
}): Promise<Metadata> {
  const { lang, hash } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const share = await fetchShareByHash(hash);
  if (!share) return { title: "Not Found" };
  const conversation = await fetchSharedConversation(share.conversation_id);
  const title = conversation?.title ?? "Shared conversation";
  return {
    title: `${title} — Branham Sermons Assistant`,
    alternates: { canonical: `${SITE_URL}/${lang}/share/${hash}` },
  };
}

export default async function LocalizedSharePage({
  params,
}: {
  params: Promise<{ lang: string; hash: string }>;
}) {
  const { lang, hash } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();

  const share = await fetchShareByHash(hash);
  if (!share || share.language !== lang) notFound();

  const [conversation, messageRows] = await Promise.all([
    fetchSharedConversation(share.conversation_id),
    fetchSharedMessages(share.conversation_id, share.cutoff_created_at),
  ]);
  if (!conversation || messageRows.length === 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === share.owner_id;

  const messages: Message[] = messageRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <SharePageShell
      conversationId={share.conversation_id}
      shareHash={hash}
      title={conversation.title}
      messages={messages}
      isOwner={isOwner}
      language={lang}
      strings={getChatStrings(lang)}
    />
  );
}
```

- [ ] **Step 4: Verify with Playwright MCP**

1. From the previous task's SQL check, take a known `share_hash`.
2. In a fresh (unauthenticated) Playwright MCP browser context, navigate to `http://localhost:3000/share/<hash>`.
3. Assert via `browser_snapshot`: the read-only banner text is visible, the shared question/answer render (citation pills intact), and there is **no** composer/input box.
4. Assert clicking a citation pill still opens the `ReferencePopover` tooltip.
5. Assert the button reads "Log in to continue this conversation"; click it and assert the `LoginModal` opens.
6. Navigate to `http://localhost:3000/share/does-not-exist` and assert a 404 page renders.

- [ ] **Step 5: Commit**

```bash
git add src/components/share/SharePageShell.tsx src/app/share/[hash]/page.tsx "src/app/[lang]/share/[hash]/page.tsx"
git commit -m "feat(share): add public read-only /share/[hash] routes"
```

---

### Task 8: Continue flow — owner passthrough, anonymous login-gate, non-owner fork

**Files:**
- Create: `src/lib/chat/forkFromShare.ts`
- Modify: `src/components/share/SharePageShell.tsx`
- Modify: `src/components/chat/ChatShell.tsx`

**Interfaces:**
- Consumes: `fetchShareByHash`, `fetchSharedConversation`, `fetchSharedMessages` (Task 4); `createConversation`, `saveMessage`, `upsertRag`, `updateConversationAfterTurn` (existing `queries.ts`); `generateId` (existing `ids.ts`).
- Produces: `forkConversationFromShare(shareHash: string, newOwnerId: string): Promise<string | null>` (returns the new `conversationId`, or `null` if the share/messages no longer exist) — used by both files this task modifies.

- [ ] **Step 1: Write `forkFromShare.ts`**

```ts
import { generateId } from "@/lib/utils/ids";
import {
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
} from "@/lib/db/queries";
import {
  fetchShareByHash,
  fetchSharedConversation,
  fetchSharedMessages,
} from "@/lib/db/share-queries";

/**
 * Forks a shared conversation into a brand-new conversation owned by
 * `newOwnerId`. Messages are copied in original order with sequential
 * awaits (not Promise.all) so each row's created_at stays monotonic —
 * chat_messages is always read back ordered by created_at ascending.
 */
export async function forkConversationFromShare(
  shareHash: string,
  newOwnerId: string,
): Promise<string | null> {
  const share = await fetchShareByHash(shareHash);
  if (!share) return null;

  const [conversation, messages] = await Promise.all([
    fetchSharedConversation(share.conversation_id),
    fetchSharedMessages(share.conversation_id, share.cutoff_created_at),
  ]);
  if (messages.length === 0) return null;

  const newConversationId = generateId();
  await createConversation(newConversationId, newOwnerId, conversation?.title ?? null);

  for (const message of messages) {
    await saveMessage(generateId(), newConversationId, newOwnerId, message.role, message.content);
  }

  await Promise.all([
    share.rag_context_snapshot
      ? upsertRag(
          newConversationId,
          share.rag_context_snapshot,
          share.retrieval_query_snapshot ?? "",
          share.retrieval_metadata_snapshot,
        )
      : Promise.resolve(),
    updateConversationAfterTurn(newConversationId, share.conversation_summary_snapshot),
  ]);

  return newConversationId;
}
```

- [ ] **Step 2: Wire the logged-in-non-owner branch into `SharePageShell.tsx`**

Replace the `handleContinue` function:
```tsx
import { forkConversationFromShare } from "@/lib/chat/forkFromShare";
// ...
  const [forking, setForking] = useState(false);

  async function handleContinue() {
    if (isOwner) {
      router.push(`/chat/${conversationId}`);
      return;
    }
    if (!user) {
      localStorage.setItem("pending_share_hash", shareHash);
      setShowLoginModal(true);
      return;
    }
    setForking(true);
    try {
      const newConversationId = await forkConversationFromShare(shareHash, user.id);
      if (newConversationId) router.push(`/chat/${newConversationId}`);
    } finally {
      setForking(false);
    }
  }
```
Disable the continue button while `forking` is true (`disabled={forking}`), matching the existing disabled-button styling used elsewhere in the app (`opacity-50` + `cursor-not-allowed` classes, conditionally applied).

- [ ] **Step 3: Wire the post-login fork branch into `ChatShell.tsx`**

In the init effect (~line 495-570), add a `pending_share_hash` branch that takes priority over — and is mutually exclusive with — the existing `pending_seo_slug` check:

```ts
    const pendingShareHash = localStorage.getItem("pending_share_hash");
    const pendingSlug = localStorage.getItem("pending_seo_slug");

    if (pendingShareHash && !initialConversationId) {
      localStorage.removeItem("pending_share_hash");
      (async () => {
        try {
          const newConvId = await forkConversationFromShare(pendingShareHash, user.id);
          if (newConvId) {
            window.history.replaceState(null, "", `/chat/${newConvId}`);
            await loadConversation(newConvId);
          }
        } catch (err) {
          console.error("Failed to fork shared conversation:", err);
        }
      })();
    } else if (pendingSlug && !initialConversationId) {
```

(Change the existing `if (pendingSlug && !initialConversationId) {` line to `else if`, keeping its body unchanged, and add `import { forkConversationFromShare } from "@/lib/chat/forkFromShare";` at the top of the file.)

- [ ] **Step 4: Verify with Playwright MCP**

1. **Owner**: log in as the share's owner, open the share URL, click continue — assert redirect to `/chat/<original conversationId>` with the live, editable conversation.
2. **Anonymous**: open the share URL in a fresh context, click continue — assert `LoginModal` opens; complete signup with a new test account — assert final redirect lands on `/chat/<new-conversation-id>` (a different id from the original) showing the same forked messages, and that a composer/input box is now present and usable.
3. **Already-logged-in, different user**: log in as a second existing test account, open the share URL, click continue — assert it directly (no page reload) forks and redirects to `/chat/<new-conversation-id>`.
4. SQL check after step 2/3: `select id, user_id, title from conversations where id = '<new-conversation-id>';` and `select role, content from chat_messages where conversation_id = '<new-conversation-id>' order by created_at asc;` — confirm `user_id` is the visitor's id (not the original owner's) and message content/order matches the original.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/forkFromShare.ts src/components/share/SharePageShell.tsx src/components/chat/ChatShell.tsx
git commit -m "feat(share): wire owner/anonymous/non-owner continue flows"
```

---

### Task 9: Client-side share card (image download)

**Files:**
- Modify: `package.json`
- Modify: `src/lib/markdown/citations.ts` (add `truncateAfterFirstCitation`)
- Create: `src/lib/share/cardBackgrounds.ts`
- Create: `src/lib/share/generateShareCard.ts`
- Create: `src/components/chat/ShareCardTemplate.tsx`
- Modify: `src/components/chat/ShareModal.tsx`

**Interfaces:**
- Consumes: `strings.shareDownloadCard`/`shareGenerating`/`shareBackgroundLabel` (Task 5); `CITATION_RE` pattern (existing, `src/lib/markdown/citations.ts:18`).
- Produces: `truncateAfterFirstCitation(text: string): string`; extends `ShareModalProps` with `firstQuestion: string | null`, `latestQuestion: string`, `answerExcerptHtml: string`, `shareHash: string` (used as the download filename suffix) — the caller (`ChatShell.handleShareConversation`) must be updated to pass these.

- [ ] **Step 0: Add `truncateAfterFirstCitation` to `citations.ts`**

Per spec, the card shows "the final answer only, truncated immediately after its first citation" — this must operate on the raw markdown (before HTML rendering), reusing the same pattern `CITATION_RE` already matches, so add a non-global sibling regex and a truncation helper:

```ts
// Non-global sibling of CITATION_RE — used for the single first-match lookup
// truncateAfterFirstCitation needs (the `g` flag on CITATION_RE keeps
// internal .lastIndex state across calls, which .exec()-based truncation
// must avoid).
const CITATION_RE_SINGLE =
  /\[([^\]]+?\s[—–\-]{1,3}\s\d{2}-\d{4}[A-Z]?(?:\d)?:\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?(?:[;,]\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?)*)\]/;

/**
 * Slices `text` to end right after its first citation pill, for the
 * share-card excerpt. Returns the full text unchanged if no citation is
 * present.
 */
export function truncateAfterFirstCitation(text: string): string {
  const match = CITATION_RE_SINGLE.exec(text);
  if (!match || match.index === undefined) return text;
  return text.slice(0, match.index + match[0].length);
}
```

- [ ] **Step 1: Add the dependency**

Run: `npm install html-to-image`
Expected: `package.json` gains `"html-to-image": "^1.11.11"` (or whatever the installed latest is) under `dependencies`.

- [ ] **Step 2: Write `cardBackgrounds.ts`**

```ts
export interface ShareCardBackground {
  id: string;
  label: string;
  css: string;
}

// Placeholder gradients matching the existing opengraph-image.tsx aesthetic.
// Swap `css` for `url('/share-backgrounds/<name>.png')` once real
// nature-photo/logo-watermark assets are supplied — no other code changes
// are needed.
export const SHARE_CARD_BACKGROUNDS: ShareCardBackground[] = [
  {
    id: "light",
    label: "Light",
    css: "linear-gradient(135deg, rgb(247, 247, 248) 0%, rgb(235, 236, 241) 100%)",
  },
  {
    id: "dark",
    label: "Dark",
    css: "linear-gradient(135deg, rgb(24, 24, 27) 0%, rgb(9, 9, 11) 100%)",
  },
  {
    id: "accent",
    label: "Accent",
    css: "linear-gradient(135deg, rgb(30, 41, 99) 0%, rgb(15, 23, 42) 100%)",
  },
];
```

- [ ] **Step 3: Write `generateShareCard.ts`**

```ts
export async function renderCardToPng(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, { width: 1200, height: 630, pixelRatio: 2 });
  if (!blob) throw new Error("Failed to generate share card image");
  return blob;
}
```

- [ ] **Step 4: Write `ShareCardTemplate.tsx`**

```tsx
"use client";

import { forwardRef } from "react";

export interface ShareCardTemplateProps {
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
  backgroundCss: string;
  readMoreLabel: string;
  readMoreUrl: string;
}

export const ShareCardTemplate = forwardRef<HTMLDivElement, ShareCardTemplateProps>(
  function ShareCardTemplate(
    { firstQuestion, latestQuestion, answerExcerptHtml, backgroundCss, readMoreLabel, readMoreUrl },
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          position: "relative",
          fontFamily: "sans-serif",
          color: "#1f1f1f",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: backgroundCss }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "56px 64px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {firstQuestion && (
              <div style={{ fontSize: 20, color: "#6b7280", marginBottom: 12 }}>
                {firstQuestion}
              </div>
            )}
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25 }}>
              {latestQuestion}
            </div>
          </div>
          <div
            style={{ fontSize: 18, lineHeight: 1.5, maxHeight: 260, overflow: "hidden" }}
            dangerouslySetInnerHTML={{ __html: answerExcerptHtml }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1d4ed8" }}>
            {readMoreLabel} → {readMoreUrl}
          </div>
        </div>
      </div>
    );
  },
);
```

- [ ] **Step 5: Extend `ShareModal.tsx`** with background picker + download button

```tsx
"use client";

import { useRef, useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";
import { SHARE_CARD_BACKGROUNDS } from "@/lib/share/cardBackgrounds";
import { renderCardToPng } from "@/lib/share/generateShareCard";
import { ShareCardTemplate } from "./ShareCardTemplate";

interface ShareModalProps {
  onClose: () => void;
  strings: ChatStrings;
  shareUrl: string;
  shareHash: string;
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
}

export function ShareModal({
  onClose,
  strings,
  shareUrl,
  shareHash,
  firstQuestion,
  latestQuestion,
  answerExcerptHtml,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const blob = await renderCardToPng(cardRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `branham-sermons-share-${shareHash.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {strings.shareModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.shareClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareLinkLabel}
        </label>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? strings.shareCopied : strings.shareCopyLink}
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareBackgroundLabel}
        </label>
        <div className="mb-4 flex gap-2">
          {SHARE_CARD_BACKGROUNDS.map((bg, i) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => setBackgroundIndex(i)}
              aria-label={bg.label}
              className={`h-8 w-8 rounded-full border-2 ${
                i === backgroundIndex ? "border-blue-500" : "border-transparent"
              }`}
              style={{ background: bg.css }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={generating}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {generating ? strings.shareGenerating : strings.shareDownloadCard}
        </button>

        <div style={{ position: "fixed", top: -9999, left: -9999 }} aria-hidden="true">
          <ShareCardTemplate
            ref={cardRef}
            firstQuestion={firstQuestion}
            latestQuestion={latestQuestion}
            answerExcerptHtml={answerExcerptHtml}
            backgroundCss={SHARE_CARD_BACKGROUNDS[backgroundIndex].css}
            readMoreLabel="Read more"
            readMoreUrl={shareUrl}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Pass the new props from `ChatShell.tsx`/`SeoShell.tsx`**

Add `truncateAfterFirstCitation` to the existing `@/lib/markdown/citations` import (both files already import `stripParagraphLetterSuffixes` from there — add it to that same import line) and import `applyCitations` alongside it plus `renderMarkdown` from `@/lib/markdown/render`.

In `handleShareConversation`, after computing `msgs`, derive the card content and store it alongside the URL:
```ts
        const firstUserMsg = msgs.find((m) => m.role === "user") ?? null;
        const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
        const lastAssistantMsg = [...msgs].reverse().find((m) => m.role === "assistant");
        const excerptMarkdown = lastAssistantMsg
          ? truncateAfterFirstCitation(lastAssistantMsg.content)
          : "";
        const answerExcerptHtml = applyCitations(renderMarkdown(excerptMarkdown));
```
Add a second state, `shareModalCard`, holding `{ firstQuestion, latestQuestion, answerExcerptHtml }`, set alongside `shareModalUrl`; pass `firstQuestion={firstUserMsg?.content ?? null}`, `latestQuestion={lastUserMsg?.content ?? ""}`, `answerExcerptHtml`, `shareHash`, into `<ShareModal>`. Since `answerExcerptHtml` already carries `.citation-pill` markup and the existing global `.citation-pill` CSS (`src/app/globals.css`) already applies document-wide, the off-screen `ShareCardTemplate` node picks it up automatically — no CSS changes are needed for this task.

- [ ] **Step 7: Verify with Playwright MCP**

1. Open the Share modal for an existing conversation.
2. Assert 3 background swatches render and clicking one changes the selected ring.
3. Click **Download image**; use the Playwright MCP download-interception (navigate/click, then check the triggered download event) to confirm a `.png` file was produced.
4. Open the downloaded file (or inspect its byte size) and confirm it's non-trivial (>10KB), indicating a real raster image was generated rather than an empty canvas.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/share/cardBackgrounds.ts src/lib/share/generateShareCard.ts src/components/chat/ShareCardTemplate.tsx src/components/chat/ShareModal.tsx src/components/chat/ChatShell.tsx src/components/seo/SeoShell.tsx
git commit -m "feat(share): add client-side share card image generation"
```

---

### Task 10: Deletion cascade + end-to-end regression pass

**Files:**
- No new files — this task is verification-only, exercising Tasks 1-9 together.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Verify deletion cascade with Playwright MCP + SQL**

1. As the owner, note a `share_hash` for one of the conversations created during Task 6's testing.
2. Delete that conversation from the sidebar (existing Delete action).
3. SQL check: `select count(*) from conversation_shares where conversation_id = '<deleted-id>';` — expect `0` (cascade fired).
4. Navigate to `/share/<hash>` — assert a 404 renders (the route's `notFound()` fires because `fetchShareByHash` now returns `null`).

- [ ] **Step 2: Full happy-path Playwright MCP run, screenshotted at each stage**

1. Log in as user A, ask a question, get an answer.
2. Share the conversation → screenshot the modal (link + card preview).
3. Open the link in a fresh anonymous context → screenshot the read-only page.
4. Click continue as anonymous → screenshot the login modal → complete signup as a brand-new user B → screenshot the resulting forked `/chat/<id>` conversation.
5. Log out, log back in as user A (the original owner) → open the same share link → click continue → screenshot landing on the original live `/chat/<original-id>` (not a fork).
6. Confirm via SQL that exactly two `conversations` rows now exist for this content: the original (user A) and the fork (user B), and that `conversation_shares` still has exactly one row (the original share, untouched by either continue action).

- [ ] **Step 3: Run lint across the whole feature**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors across all files touched in Tasks 1-9.

- [ ] **Step 4: Commit** (only if Step 1-3 surfaced fixes; otherwise this task has nothing to commit)

```bash
git add -A
git commit -m "test(share): verify deletion cascade and full continue-flow regression"
```