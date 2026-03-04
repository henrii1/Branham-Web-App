-- ============================================================
-- Branham Web App — Initial Schema Migration
-- Tables: profiles, conversations, chat_messages,
--         conversation_rag, seo_cache, sermon_metadata,
--         intro_messages
-- Plus: RLS policies, indexes, triggers
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. Helper: auto-update updated_at column
-- ────────────────────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Tables
-- ────────────────────────────────────────────────────────────

-- 2a. profiles (one per auth.users row)
create table public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  language          text not null default 'en',
  welcome_email_sent_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- 2b. conversations
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  title                 text,
  conversation_summary  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at();

-- 2c. chat_messages
create table public.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  created_at        timestamptz not null default now()
);

-- 2d. conversation_rag (one-to-one with conversations, UPSERT pattern)
create table public.conversation_rag (
  conversation_id     uuid primary key references public.conversations(id) on delete cascade,
  rag_context         text not null,
  retrieval_query     text not null,
  retrieval_metadata  jsonb,
  updated_at          timestamptz not null default now()
);

create trigger conversation_rag_updated_at
  before update on public.conversation_rag
  for each row execute function public.update_updated_at();

-- 2e. seo_cache (curated SEO pages)
create table public.seo_cache (
  slug                text primary key,
  question            text not null,
  robust_query        text not null,
  answer_markdown     text not null,
  rag_context         text not null,
  conversation_summary text,
  language            text not null default 'en',
  published           boolean not null default false,
  meta_title          text,
  meta_description    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger seo_cache_updated_at
  before update on public.seo_cache
  for each row execute function public.update_updated_at();

-- 2f. sermon_metadata (optional reference data)
create table public.sermon_metadata (
  date_id     text primary key,
  title       text not null,
  preacher    text not null default 'William Marrion Branham',
  language    text not null default 'en',
  created_at  timestamptz not null default now()
);

-- 2g. intro_messages (email templates)
create table public.intro_messages (
  id          uuid primary key default gen_random_uuid(),
  language    text not null,
  subject     text not null,
  body_markdown text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger intro_messages_updated_at
  before update on public.intro_messages
  for each row execute function public.update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. Indexes
-- ────────────────────────────────────────────────────────────

-- Sidebar query: list user conversations newest first
create index idx_conversations_user_updated
  on public.conversations (user_id, updated_at desc);

-- Message loading: fetch messages in chronological order
create index idx_chat_messages_conversation_created
  on public.chat_messages (conversation_id, created_at asc);

-- RLS performance: lookup messages by user
create index idx_chat_messages_user_id
  on public.chat_messages (user_id);

-- SEO listing/sitemap: published pages by language
create index idx_seo_cache_published_lang
  on public.seo_cache (published, language)
  where published = true;

-- ────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ────────────────────────────────────────────────────────────

-- 4a. profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4b. conversations
alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select
  using (user_id = auth.uid());

create policy "Users can create own conversations"
  on public.conversations for insert
  with check (user_id = auth.uid());

create policy "Users can update own conversations"
  on public.conversations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own conversations"
  on public.conversations for delete
  using (user_id = auth.uid());

-- 4c. chat_messages
alter table public.chat_messages enable row level security;

create policy "Users can view own messages"
  on public.chat_messages for select
  using (user_id = auth.uid());

create policy "Users can create own messages"
  on public.chat_messages for insert
  with check (user_id = auth.uid());

create policy "Users can delete own messages"
  on public.chat_messages for delete
  using (user_id = auth.uid());

-- 4d. conversation_rag (access via ownership of parent conversation)
alter table public.conversation_rag enable row level security;

create policy "Users can view own conversation rag"
  on public.conversation_rag for select
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create policy "Users can insert own conversation rag"
  on public.conversation_rag for insert
  with check (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create policy "Users can update own conversation rag"
  on public.conversation_rag for update
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create policy "Users can delete own conversation rag"
  on public.conversation_rag for delete
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- 4e. seo_cache (public read for published, no client writes)
alter table public.seo_cache enable row level security;

create policy "Anyone can read published seo pages"
  on public.seo_cache for select
  using (published = true);

-- 4f. sermon_metadata (public read, no client writes)
alter table public.sermon_metadata enable row level security;

create policy "Anyone can read sermon metadata"
  on public.sermon_metadata for select
  using (true);

-- 4g. intro_messages (public read for email templates, no client writes)
alter table public.intro_messages enable row level security;

create policy "Anyone can read intro messages"
  on public.intro_messages for select
  using (true);

-- ────────────────────────────────────────────────────────────
-- 5. Auto-create profile on user signup
-- ────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'en'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
