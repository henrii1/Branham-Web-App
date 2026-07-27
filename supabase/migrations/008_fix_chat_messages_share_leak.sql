-- Closes a gap left by 007: the "Anyone can view shared messages" policy
-- granted access to every message of any shared conversation to anyone
-- holding the public anon key, regardless of whether they possessed that
-- share's actual hash. anon/authenticated retain the default table-level
-- SELECT grant on chat_messages (never revoked, unlike conversation_shares),
-- so `message_is_shared(conversation_id, created_at)` — which only checks
-- "does some share exist for this conversation" — let a client bypass the
-- app entirely and bulk-read every shared conversation's message content
-- via `supabase.from('chat_messages').select()`, with no share link needed
-- at all. This mirrors the get_conversation_share() fix from 007: replace
-- the broad table-level policy with a security-definer RPC that only
-- returns rows when the caller supplies the exact hash.

drop policy if exists "Anyone can view shared messages" on public.chat_messages;

-- message_is_shared() is no longer referenced by any policy; drop it.
drop function if exists public.message_is_shared(uuid, timestamptz);

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
  where s.share_hash = p_share_hash
    and m.created_at <= s.cutoff_created_at;
$$;

grant execute on function public.get_shared_messages(text) to anon, authenticated;
