-- alert_state: server-side rate-limit ledger for operational alerts
-- (e.g. weekly "model call failure" email). Singleton-row pattern — one
-- row per alert key. Only the Worker (service-role) writes here; RLS is
-- enabled with no policies, so anon / authenticated users cannot read
-- or modify it.

create table if not exists public.alert_state (
  key          text primary key,
  last_sent_at timestamptz not null default 'epoch'::timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.alert_state enable row level security;

-- No policies: locks down all roles except service-role (which bypasses RLS).

insert into public.alert_state (key)
values ('model_call_failure')
on conflict (key) do nothing;