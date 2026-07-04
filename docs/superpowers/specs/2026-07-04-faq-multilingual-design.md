# FAQ Multilingual Design

**Date:** 2026-07-04  
**Status:** Approved  
**Scope:** Spanish and French support for `/faq` and `/q/[slug]` pages only. No changes to chat, auth, or profile systems.

---

## 1. Goals

- Make the FAQ and individual question pages available in Spanish (`/es/`) and French (`/fr/`) so Google can index them in those language corpora.
- Auto-redirect logged-in users to their profile language version when they land on an English FAQ/question URL.
- Add a language switcher (globe icon + dropdown) in the page header so any user can switch language manually.
- Minimise complexity: no new tables, no new auth logic, no changes to the chat system.

---

## 2. Database

**Table:** `seo_cache`

**Migration:** Change the primary key from `slug` alone to a composite `(slug, language)`.

```sql
ALTER TABLE seo_cache DROP CONSTRAINT seo_cache_pkey;
ALTER TABLE seo_cache ADD PRIMARY KEY (slug, language);
```

All existing rows already have `language = 'en'` and are unaffected. New ES and FR rows share the same `slug` value with a different `language` value.

**Fields carried over unchanged:** `question` (kept in English across all language variants), `robust_query`, `published`.

**Fields populated for translated rows:** `answer_markdown` (from the API), `language`, `slug`, `question`, `robust_query`, `published: true`. Fields `rag_context`, `conversation_summary`, `meta_title`, `meta_description` are left `null` for translated rows — pages fall back to constructed strings for meta.

---

## 3. Query Layer (`src/lib/db/seo-queries.ts`)

All functions that currently hardcode `.eq("language", "en")` gain a `language` parameter:

| Function | Signature change |
|---|---|
| `fetchSeoPage` | `(slug: string, language: string)` |
| `fetchAllPublishedSeoPages` | `(language: string)` |
| `fetchAdjacentSeoPages` | `(slug: string, language: string)` |
| `fetchTopPublishedSeoPages` | unchanged — EN only, used on landing page |

Call sites in the existing `/faq` and `/q/[slug]` pages pass `"en"`; the new `[lang]` pages pass the validated lang param.

---

## 4. Population Script

**Location:** `scripts/populate-faq-translations.ts`  
**Run:** `CHAT_API_BEARER_KEY=... MODEL_API_BASE_URL=... npx tsx scripts/populate-faq-translations.ts`

**Algorithm:**
1. Fetch all published EN rows from `seo_cache` (slug, question, robust_query).
2. For each row × each target language (`["es", "fr"]`):
   - Check if `(slug, language)` already exists → skip (idempotent).
   - POST `robust_query` as `query` to `MODEL_API_BASE_URL/api/chat` with `user_language: <lang>` and `Authorization: Bearer CHAT_API_BEARER_KEY`.
   - Parse the SSE stream; wait for the `final` event; capture `final.answer`.
   - Upsert: `{ slug, language, question, robust_query, answer_markdown: final.answer, published: true }`.
3. Log progress per row (slug + language + success/skip/error).

The script calls the Model API directly (not the same-origin proxy) since it runs server-side with the bearer key available.

---

## 5. Routing

**New files inside `src/app/(app)/`:**

```
[lang]/faq/page.tsx
[lang]/q/[slug]/page.tsx
```

Both pages validate `params.lang` at the top:

```ts
const SUPPORTED_LANGS = ["es", "fr"] as const;
if (!SUPPORTED_LANGS.includes(params.lang as never)) notFound();
```

Named segments (`chat`, `faq`, `q`) take Next.js routing priority over `[lang]`, so existing routes are unaffected.

Both pages export `generateStaticParams`:
- `[lang]/faq/page.tsx` → `[{ lang: "es" }, { lang: "fr" }]`
- `[lang]/q/[slug]/page.tsx` → all `(lang, slug)` combinations from the DB for ES and FR rows

This lets Cloudflare Workers serve these as pre-rendered assets.

---

## 6. Auto-redirect (English pages only)

Added at the top of the server component in each English page. The redirect target differs per page:

**`/faq/page.tsx`:**
```ts
if (lang === "es") redirect("/es/faq");
if (lang === "fr") redirect("/fr/faq");
```

**`/q/[slug]/page.tsx`** (where `params.slug` is already in scope):
```ts
if (lang === "es") redirect(`/es/q/${params.slug}`);
if (lang === "fr") redirect(`/fr/q/${params.slug}`);
```

Both follow the same auth check:
```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { data: profile } = await supabase
    .from("profiles").select("language").eq("user_id", user.id).maybeSingle();
  const lang = profile?.language;
  // redirect per above
}
```

- Anonymous users and `language = "en"` (or null) profiles → no redirect, EN page renders.
- The `/es/` and `/fr/` pages do **not** contain this redirect logic — no redirect loops.

---

## 7. Language Switcher — `LangSwitcher` Component

**File:** `src/components/seo/LangSwitcher.tsx` (`"use client"`)

A globe icon button that opens a small dropdown with `<Link>` tags for each language. Click-outside closes it (same `useEffect` + `useRef` pattern as `LangAnnounceBanner`).

**Props:**
```ts
interface LangSwitcherProps {
  current: "en" | "es" | "fr";
  hrefs: { en: string; es: string; fr: string };
}
```

`hrefs` is computed in the server component from the current slug/page and passed down — the client component itself has no routing logic.

**Placement:** Inserted into the header `<div>` of `/faq/page.tsx`, `/es/faq/page.tsx`, `/fr/faq/page.tsx`, `/q/[slug]/page.tsx`, and both `[lang]/q/[slug]/page.tsx` variants. Sits between the logo and the "Ask a question" button.

**Labels in dropdown:**
```
🌐  English
    Español
    Français
```

Active language has a checkmark. Inactive languages are plain `<Link>` tags navigating to the sibling URL.

---

## 8. SEO — hreflang & Sitemap

**hreflang** via Next.js `alternates.languages` in `generateMetadata` / `metadata`:

```ts
alternates: {
  canonical: `${SITE_URL}/q/${slug}`,
  languages: {
    "en":        `${SITE_URL}/q/${slug}`,
    "es":        `${SITE_URL}/es/q/${slug}`,
    "fr":        `${SITE_URL}/fr/q/${slug}`,
    "x-default": `${SITE_URL}/q/${slug}`,
  },
},
```

Same pattern on `/faq` / `/es/faq` / `/fr/faq`.

**`src/app/sitemap.ts`:** Updated to include ES and FR URL variants for every published slug, plus the `/es/faq` and `/fr/faq` list pages.

**JSON-LD:** Individual question pages already emit `inLanguage: page.language || "en"` — ES/FR pages will correctly emit `"es"` and `"fr"`.

---

## 9. What Does Not Change

- Chat system, SSE pipeline, `ChatShell`, `MessageBubble`, reference popovers — untouched.
- `profiles` table — untouched (already stores `language`).
- `LangAnnounceBanner`, `LangFeatureModal`, `LanguageOnlyModal` — untouched.
- `conversations`, `chat_messages`, `conversation_rag` — untouched.
- The `fetchTopPublishedSeoPages` function (used on the landing page) — EN only, unchanged.

---

## 10. File Checklist

| File | Action |
|---|---|
| `supabase/migrations/<timestamp>_seo_cache_composite_pk.sql` | New — composite PK migration |
| `scripts/populate-faq-translations.ts` | New — population script |
| `src/lib/db/seo-queries.ts` | Edit — add `language` param to 3 functions |
| `src/components/seo/LangSwitcher.tsx` | New — globe dropdown client component |
| `src/app/(app)/faq/page.tsx` | Edit — add auto-redirect + `LangSwitcher` |
| `src/app/(app)/q/[slug]/page.tsx` | Edit — add auto-redirect + `LangSwitcher` |
| `src/app/(app)/[lang]/faq/page.tsx` | New — ES/FR FAQ list page |
| `src/app/(app)/[lang]/q/[slug]/page.tsx` | New — ES/FR question page |
| `src/app/sitemap.ts` | Edit — add ES/FR URLs |