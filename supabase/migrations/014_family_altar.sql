-- Family Altar: one devotional per day per language, generated weekly by the
-- Model API's devotional mode (response_mode = "devotional").
--
-- The table holds at most the current week and the next (each weekly run
-- adds next week and deletes days before the current week), so readers in
-- time zones already on Monday never lose Sunday's devotional.
--
-- Reads: anyone, but only finished days (status = 'ready').
-- Writes: service-role client only (cron route + admin routes), so there are
-- no insert/update/delete policies.

create table public.family_altar_days (
  day                     date        not null,
  language                text        not null check (language in ('en', 'es', 'fr')),
  week_start              date        not null,                -- Monday of the day's week
  scripture_ref           text        not null,                -- canonical, e.g. "Hebrews 1:1-2"
  bible_version           text        not null default 'KJV',
  scripture_text          text        not null,
  title                   text,
  reflection_markdown     text,
  sermon_quotes_markdown  text,
  discussion_questions    jsonb       not null default '[]'::jsonb,
  prayer_intro            text,
  prayer_points           jsonb       not null default '[]'::jsonb,
  sermon_references       jsonb       not null default '[]'::jsonb,
  answer_markdown         text,                                -- full devotional as returned by the API
  rag_context             text,
  status                  text        not null default 'pending'
                                      check (status in ('pending', 'generating', 'ready', 'failed')),
  error                   text,
  generated_at            timestamptz,
  edited_at               timestamptz,
  edited_by               uuid,
  updated_at              timestamptz not null default now(),
  primary key (day, language)
);

create index family_altar_days_week_idx
  on public.family_altar_days (language, week_start);

create trigger family_altar_days_updated_at
  before update on public.family_altar_days
  for each row execute function public.update_updated_at();

alter table public.family_altar_days enable row level security;

create policy "Anyone can read finished family altar days"
  on public.family_altar_days for select
  using (status = 'ready');

-- Belt and braces: no direct writes from the anon/authenticated roles.
revoke insert, update, delete on public.family_altar_days from anon, authenticated;
