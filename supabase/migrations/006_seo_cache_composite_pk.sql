-- Change seo_cache primary key from slug alone to (slug, language)
-- so one question slug can have rows for multiple languages.
-- All existing rows already have language = 'en' and are unaffected.

ALTER TABLE public.seo_cache DROP CONSTRAINT seo_cache_pkey;
ALTER TABLE public.seo_cache ADD PRIMARY KEY (slug, language);