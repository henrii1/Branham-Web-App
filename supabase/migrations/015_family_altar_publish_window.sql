-- Family Altar: keep next week private until it starts somewhere.
--
-- Next week is generated a week ahead so the admins can review and edit it.
-- Readers' pages only show their own current week, but the old policy let
-- anyone read every published row through the API. Now a week becomes
-- public only once its Monday has begun in the earliest time zone (UTC+14),
-- i.e. from Sunday 10:00 UTC — so every reader still gets Monday at their
-- own midnight, and until then only the admin tools (service role) see it.
--
-- date_trunc('week', …) is ISO: it returns the Monday of that week.

drop policy if exists "Anyone can read finished family altar days" on public.family_altar_days;

create policy "Anyone can read finished family altar days that have started"
  on public.family_altar_days for select
  using (
    status = 'ready'
    and week_start <= (date_trunc('week', (now() at time zone 'utc') + interval '14 hours'))::date
  );
