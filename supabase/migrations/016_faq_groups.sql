-- FAQ groups.
--
-- The FAQ page shows questions in groups. Exactly one group is doctrinal
-- ("William Branham Doctrines": what Brother Branham taught — every FAQ that
-- existed before this migration); every other group is a Bible group
-- (answered from Scripture), created by the admins from the Add-to-FAQ
-- dialog with a name in each language.
--
-- The group's kind decides how its answers are generated (faq_kind sent to
-- the Model API). A question's group is stored on every language row of its
-- slug, so all three pages always agree.

create table public.faq_groups (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('doctrinal', 'bible')),
  name_en     text not null check (char_length(name_en) between 1 and 80),
  name_es     text not null check (char_length(name_es) between 1 and 80),
  name_fr     text not null check (char_length(name_fr) between 1 and 80),
  created_at  timestamptz not null default now()
);

-- At most one doctrinal group.
create unique index faq_groups_one_doctrinal on public.faq_groups (kind) where kind = 'doctrinal';
-- No two groups with the same English name.
create unique index faq_groups_name_en_unique on public.faq_groups (lower(name_en));

alter table public.faq_groups enable row level security;
-- Public read (the FAQ pages list them); writes only through the service-role
-- client in the admin routes.
create policy "Anyone can read FAQ groups"
  on public.faq_groups for select
  using (true);
revoke insert, update, delete on public.faq_groups from anon, authenticated;

insert into public.faq_groups (kind, name_en, name_es, name_fr)
values ('doctrinal', 'William Branham Doctrines', 'Doctrinas de William Branham', 'Doctrines de William Branham');

-- A question's group. Nullable so older tooling (scripts/seed-seo.ts) still
-- inserts; the app treats a missing group as the doctrinal group.
alter table public.seo_cache
  add column group_id uuid references public.faq_groups (id) on delete restrict;

update public.seo_cache
  set group_id = (select id from public.faq_groups where kind = 'doctrinal')
  where group_id is null;

create index idx_seo_cache_group on public.seo_cache (group_id);
