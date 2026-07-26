-- conversation_shares: public read-only share links for conversations.
-- Each Share click inserts a new row (new hash); rows are immutable —
-- no update/delete policy, so the only removal path is the cascade from
-- deleting the source conversation. RAG context, title, and summary are
-- all pinned here (not read live from conversations/conversation_rag)
-- for two reasons: (1) conversation_rag is upserted latest-only and
-- would otherwise be overwritten by a later turn on the same
-- conversation; (2) conversations.conversation_summary is rewritten on
-- every turn, so if the public path read it live, a conversation shared
-- at turn 3 and continued to turn 5 would leak turn 4-5 content through
-- that column even though chat_messages stays properly cutoff-gated.
-- Pinning title/summary here means there is NO public select policy on
-- `conversations` at all — the live table is never reachable through
-- the share mechanism, closing that leak at the schema level rather
-- than relying on the application to simply not ask for the column
-- (the anon key is public, so anyone could query it directly otherwise).

create table public.conversation_shares (
  id                            uuid primary key default gen_random_uuid(),
  share_hash                    text unique not null,
  conversation_id               uuid not null references public.conversations(id) on delete cascade,
  owner_id                      uuid not null references auth.users(id),
  language                      text not null,
  cutoff_created_at             timestamptz not null,
  title_snapshot                text,
  rag_context_snapshot          text,
  retrieval_query_snapshot      text,
  retrieval_metadata_snapshot   jsonb,
  conversation_summary_snapshot text,
  created_at                    timestamptz not null default now()
);

create index conversation_shares_conversation_id_idx
  on public.conversation_shares (conversation_id);

alter table public.conversation_shares enable row level security;

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

-- No direct-table select policy at all for anon/authenticated: a plain
-- `using (true)` policy (the original spec's design) makes the whole
-- table world-readable via the public anon key — anyone could `select *`
-- and harvest every user's share_hash + owner_id + snapshot content
-- without ever being sent a specific link. Reads must go through
-- get_conversation_share() below instead, which only returns a row when
-- the caller already supplies the exact (unguessable, 128-bit) hash —
-- there is no query shape that enumerates the table through that path.
revoke select on public.conversation_shares from anon, authenticated;

-- security definer: the only public read path onto conversation_shares.
-- Bypasses the revoke above internally (owner-execution context) but
-- only ever returns the single row matching an already-known hash.
create or replace function public.get_conversation_share(p_share_hash text)
returns public.conversation_shares
language sql
security definer
set search_path = public
stable
as $$
  select * from public.conversation_shares where share_hash = p_share_hash;
$$;

grant execute on function public.get_conversation_share(text) to anon, authenticated;

-- security definer: lets the chat_messages policy below check "is this
-- message visible through some share's cutoff" without granting
-- anon/authenticated direct table access to conversation_shares (which
-- would reopen the enumeration hole the revoke above closes).
create or replace function public.message_is_shared(p_conversation_id uuid, p_created_at timestamptz)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.conversation_shares
    where conversation_id = p_conversation_id
      and p_created_at <= cutoff_created_at
  );
$$;

grant execute on function public.message_is_shared(uuid, timestamptz) to anon, authenticated;

-- chat_messages: publicly readable through a valid share's cutoff. This
-- composes with (does not replace) the existing owner-only select
-- policy — Postgres ORs multiple permissive select policies together.
-- There is deliberately no equivalent policy added to `conversations`:
-- the public share page never reads the live conversations row at all,
-- only conversation_shares' pinned title_snapshot/conversation_summary_snapshot.
create policy "Anyone can view shared messages"
  on public.chat_messages for select
  using (public.message_is_shared(chat_messages.conversation_id, chat_messages.created_at));
