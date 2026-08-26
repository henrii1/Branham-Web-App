-- admin_email_sends: audit trail + double-send guard for the admin
-- bulk-email tool (src/app/api/admin/send-email/route.ts). A row is
-- inserted with status 'sending' before sendBulkEmail() is called, then
-- updated to 'complete' (with final counts) or 'failed' once it resolves.
-- The route checks for an existing 'sending' row from the same sender
-- within a short window before starting a new send, so a reload, a
-- second tab, or a retried request can't fire a second real send while
-- one is still in flight.
--
-- This table is never read or written by anon/authenticated — only the
-- service-role client (src/lib/supabase/admin.ts) touches it, from
-- inside the already admin-gated route. Same lockdown pattern as
-- conversation_shares (007_conversation_shares.sql): RLS enabled with
-- zero policies denies all access by default, and the explicit revoke
-- below is a second, independent layer on top of that.

create table public.admin_email_sends (
  id               uuid primary key default gen_random_uuid(),
  sender_user_id   uuid not null references auth.users(id),
  language         text not null,
  subject          text not null,
  body_markdown    text not null,
  recipient_count  integer not null,
  sent_count       integer,
  failed_count     integer,
  failures         jsonb,
  status           text not null default 'sending' check (status in ('sending', 'complete', 'failed')),
  error            text,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index admin_email_sends_sender_status_idx
  on public.admin_email_sends (sender_user_id, status, created_at);

alter table public.admin_email_sends enable row level security;

-- No policies: RLS-enabled + zero policies denies all access to
-- anon/authenticated by default. The explicit revoke below is a second,
-- independent layer on top of that — this table has no public read or
-- write path at all, by design.
revoke all on public.admin_email_sends from anon, authenticated;
