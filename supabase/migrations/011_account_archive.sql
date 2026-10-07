-- Account deletion is an archive, not a hard delete.
--
-- /api/account/delete calls auth.admin.deleteUser(id, true) — Supabase's
-- soft delete. The auth.users row stays (so the `on delete cascade` FKs
-- from profiles, conversations, chat_messages and conversation_rag never
-- fire and the user's data is kept), its email is scrambled and its
-- identities removed (so the same address can sign up again as a fresh
-- account), and auth.users.deleted_at is set. The soft delete cannot be
-- undone.
--
-- Because the scrambled email can no longer identify whose data an
-- archived account holds, the route records it here first.

-- ────────────────────────────────────────────────────────────
-- 1. Archive record
-- ────────────────────────────────────────────────────────────
-- Locked down like admin_email_sends: RLS on with zero policies plus an
-- explicit revoke, so only the service-role client (inside the
-- authenticated delete route) can read or write it. No FK to auth.users,
-- so this record can never block or be removed by any future change to
-- the auth row.
create table public.archived_accounts (
  user_id     uuid primary key,
  email       text not null,
  archived_at timestamptz not null default now()
);

alter table public.archived_accounts enable row level security;

revoke all on public.archived_accounts from anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. Share links stop working when their owner's account is archived
-- ────────────────────────────────────────────────────────────
-- Gating on auth.users.deleted_at (set by the soft delete itself) rather
-- than flagging share rows from the route means there is no window in
-- which the account is archived but its shares are still public. Share
-- rows are left intact as part of the archive. Same signatures, so the
-- existing anon/authenticated execute grants carry over.

create or replace function public.get_conversation_share(p_share_hash text)
returns public.conversation_shares
language sql
security definer
set search_path = public
stable
as $$
  select s.*
  from public.conversation_shares s
  join auth.users u on u.id = s.owner_id
  where s.share_hash = p_share_hash
    and u.deleted_at is null;
$$;

create or replace function public.get_shared_messages(p_share_hash text)
returns setof public.chat_messages
language sql
security definer
set search_path = public
stable
as $$
  select m.*
  from public.chat_messages m
  join public.conversation_shares s on s.conversation_id = m.conversation_id
  join auth.users u on u.id = s.owner_id
  where s.share_hash = p_share_hash
    and u.deleted_at is null
    and m.created_at <= s.cutoff_created_at;
$$;
