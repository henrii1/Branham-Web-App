# Conversation Share Feature

**Date:** 2026-07-26
**Status:** Approved

## Problem

There is no way for a user to share a conversation (or a specific Q&A within one) outside the app. We want a Share action on every conversation that produces a shareable image "card" (question + a short answer excerpt + one citation) and a public read-only link to the full conversation, with a controlled path for a signed-in visitor to continue the conversation on their own account.

## Goals

- A Share action on every conversation, producing:
  - A downloadable/shareable image card (question + short answer + one citation + "Read more" link).
  - A public, read-only URL (`/share/[hash]`, `/[lang]/share/[hash]`) showing the full conversation.
- Non-logged-in visitors can read the shared conversation but cannot continue it (login-gated, matching the existing SEO-page pattern).
- Logged-in visitors who are not the owner get forked into their own new conversation when they continue; the original owner's conversation is never written to by someone else.
- The owner clicking their own share's continue action returns to their real, live conversation (no fork, no duplicate).
- RLS is extended so a shared conversation's `conversations`/`chat_messages` rows become publicly readable (not editable) by anyone holding the share hash — everything else stays private.
- Route/data model is scalable to more languages beyond the current en/es/fr.
- Deleting the original conversation kills all of its share links (cascade), since nothing about a share should outlive its source.

## Non-Goals

- No revoke/expiry mechanism for share links (once shared, a link is permanent until the source conversation is deleted).
- No per-turn sharing UI (only one Share action per conversation, always targeting the latest turn at time of sharing).
- No changes to the Python RAG API (`Branham-LLM-AI-API`) — this feature is entirely within `Branham-Web-App`. A continued conversation after a fork is an ordinary `/api/chat` follow-up; the API has no concept of sharing.
- No dynamic per-share `og:image` generation — the card is a client-generated downloadable image, not wired into the page's link-preview metadata in this iteration.
- No custom n-gram/highlighting work (tracked separately as its own fix/spec).

---

## Data Model

One new table. No duplication of full conversation content — `conversations` and `chat_messages` are read live (they are append-only; nothing in the existing app ever edits or deletes a past message), gated by a cutoff. `conversation_rag` is **not** read live for shares, because it is upserted latest-only (one row per conversation) — if the owner asks a follow-up after sharing, the old RAG context for the shared turn would otherwise be overwritten and unrecoverable. That one piece is pinned.

```sql
create table conversation_shares (
  id                          uuid primary key default gen_random_uuid(),
  share_hash                  text unique not null,        -- random public token (e.g. nanoid(16)), not derived from conversation_id
  conversation_id             uuid not null references conversations(id) on delete cascade,
  owner_id                    uuid not null references auth.users(id),
  language                    text not null,                -- 'en' | 'es' | 'fr' | future values
  cutoff_created_at           timestamptz not null,          -- freezes which chat_messages rows are visible through this hash
  rag_context_snapshot        text,                          -- pinned copy of conversation_rag.rag_context as of share time
  retrieval_query_snapshot    text,
  retrieval_metadata_snapshot jsonb,
  conversation_summary_snapshot text,                        -- pinned conversations.conversation_summary, used to seed a fork
  created_at                  timestamptz not null default now()
);

create index conversation_shares_conversation_id_idx on conversation_shares(conversation_id);
```

Each Share click inserts a **new row** (new hash) — never updates an existing one. Old share links keep resolving to their own frozen cutoff even after newer shares of the same conversation are created.

### RLS changes

- `conversation_shares`:
  - `select`: public (`using (true)`) — the hash itself is the access control; no sensitive data lives in this table beyond what's already being deliberately shared.
  - `insert`: `with check (auth.uid() = owner_id and conversation_id in (select id from conversations where user_id = auth.uid()))`.
  - No `update`/`delete` policy — rows are immutable and there is no revoke feature.
- `conversations`: add a `select` policy —
  ```sql
  using (
    auth.uid() = user_id
    or exists (select 1 from conversation_shares s where s.conversation_id = conversations.id)
  )
  ```
- `chat_messages`: add a `select` policy —
  ```sql
  using (
    auth.uid() = user_id
    or exists (
      select 1 from conversation_shares s
      where s.conversation_id = chat_messages.conversation_id
        and chat_messages.created_at <= s.cutoff_created_at
    )
  )
  ```
  A message becomes publicly visible once *any* share's cutoff covers it; messages created after every existing share's cutoff remain private.
- `conversation_rag`: **unchanged**. The shared view never queries it — it uses the pinned snapshot columns on `conversation_shares` instead.
- Existing owner-only `insert`/`update`/`delete` policies on all three tables are unchanged — non-owners still cannot write.

---

## Routes

Following the existing `[lang]/q/[slug]` convention (top-level `[lang]` segment, English unprefixed) rather than nesting `lang` under `share`:

- `src/app/share/[hash]/page.tsx` — English/default.
- `src/app/[lang]/share/[hash]/page.tsx` — es/fr/future languages.

Both are server components mirroring `[lang]/q/[slug]/page.tsx`:

1. Look up `conversation_shares` by `share_hash`; `notFound()` if missing or if `language` param doesn't match the row's `language`.
2. Fetch `conversations` (title/summary) and `chat_messages` where `conversation_id` matches and `created_at <= cutoff_created_at`, both via the new public RLS policies.
3. Render the full multi-turn history read-only, reusing the existing chat-message rendering components (citation pill styling comes for free).
4. Where the live chat route would show an input box, anonymous visitors instead see a login prompt (reusing the existing SEO-page login-modal + pending-action-in-localStorage pattern from `SeoShell.handleFollowUp`).

---

## Card Generation (client-side)

Triggered by the Share action. This is also the point at which the `conversation_shares` row is inserted and the hash is minted.

- **Dimensions**: 1200×630, matching the existing `opengraph-image.tsx` convention used elsewhere in the app.
- **Background**: one of three user-supplied nature-photo/logo-watermark images (light, dark, and a spare/alt), bundled as static FE assets like the app logo. The user can pick/change which background is used when generating a card. Provided as PNG/JPEG; resized to 1200×630 as needed.
- **Content composited over the background**:
  - Multi-turn conversation: the **first** question (greyed out, for context) and the **latest** question (bold, the primary ask). Single-turn: just that one question, bold.
  - The **final** answer only, truncated immediately after its first citation (i.e., everything from the start of the answer through the end of the first citation reference, inclusive).
  - That one citation rendered in the same pill style used in the chat UI (`citation-pill` styling from `src/lib/markdown/citations.ts`).
  - A "Read more" link/label pointing at the new `/share/[hash]` (or `/[lang]/share/[hash]`) URL.

---

## Continue Flow

- **Not logged in**: login modal shown, matching the existing SEO-page pattern; pending "continue" action cached until after login.
- **Logged in, `auth.uid() == conversation_shares.owner_id`**: route straight to `/chat/[conversation_id]` — their real, live conversation. No fork, no new row.
- **Logged in, not the owner**: client-side fork —
  1. Create a new `conversations` row (owned by the visitor), seeding `conversation_summary` from `conversation_summary_snapshot`.
  2. Copy the `chat_messages` rows visible through this share (`created_at <= cutoff_created_at`) into new rows under the new `conversation_id`, owned by the visitor.
  3. Seed a new `conversation_rag` row from the three pinned `*_snapshot` columns.
  4. Redirect to `/chat/[new_conversation_id]`.

This mirrors the shape of the existing SEO→chat handoff (`createConversation` / `saveMessage` / `upsertRag` / `updateConversationAfterTurn` in `SeoShell.handleFollowUp`), generalized from one Q&A pair to N messages — that existing code path should be reused/extended rather than reimplemented. From this point forward, continuing the conversation is an ordinary `/api/chat` follow-up call; the Python API is never aware a fork happened.

---

## Deletion Semantics

`conversation_shares.conversation_id` has `on delete cascade` against `conversations`. Deleting the source conversation deletes every share row that pointed at it, which in turn makes the RLS `exists (...)` checks on `conversations`/`chat_messages` false again — the old share links 404 (or resolve to "not found," since the lookup in step 1 of the route fails once the row is gone).

---

## Out of Scope / Deferred

- Revoke/expiry of individual share links.
- Per-turn share buttons.
- Dynamic `og:image` per share (static/default OG image remains for now).
- The n-gram passage-highlighting fix (separate spec).
