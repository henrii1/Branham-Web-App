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
