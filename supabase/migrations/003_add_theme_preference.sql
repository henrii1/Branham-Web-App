alter table public.profiles
add column if not exists theme_preference text not null default 'light';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
    add constraint profiles_theme_preference_check
    check (theme_preference in ('light', 'dark'));
  end if;
end $$;
