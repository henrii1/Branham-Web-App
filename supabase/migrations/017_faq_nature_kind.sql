-- A third FAQ kind and Bible follow-ups.
--
-- "nature" (Christianity Seen in Nature, shown first on the FAQ page): FAQs
-- that show from nature and natural principles that God exists, written by
-- the admins (never generated) and not quoting the Bible. Every existing
-- Bible group holds questions of this kind, so they all move to it; the
-- "bible" kind stays for Scripture-first FAQs added later.
--
-- The doctrinal group is renamed to "Doctrinal Truths".
--
-- conversations.source_faq_kind: set when a chat starts as a follow-up on a
-- Bible or nature FAQ page, so every turn of it is answered from Scripture
-- (Model API followup_kind = 'bible').

alter table public.faq_groups drop constraint faq_groups_kind_check;
alter table public.faq_groups
  add constraint faq_groups_kind_check check (kind in ('doctrinal', 'bible', 'nature'));

update public.faq_groups set kind = 'nature' where kind = 'bible';

update public.faq_groups
  set name_en = 'Doctrinal Truths', name_es = 'Verdades doctrinales', name_fr = 'Vérités doctrinales'
  where kind = 'doctrinal';

alter table public.conversations
  add column source_faq_kind text check (source_faq_kind in ('bible', 'nature'));
