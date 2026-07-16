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

- `profiles` table — untouched (already stores `language`).
- `conversations`, `chat_messages`, `conversation_rag` — untouched.
- The `fetchTopPublishedSeoPages` function (used on the landing page) — EN only, unchanged.

---

## 11. Adding a New Language — Checklist

When adding a language beyond EN/ES/FR, every item below must be addressed. Skipping any one of them will leave that surface in English regardless of the user's chosen language.

### A. Chat UI strings — `src/lib/i18n/chatStrings.ts`

This is the single source of truth for all chat-surface copy. Add a new top-level key matching the language code (e.g. `"pt"`). The object must contain every key already present on the `en` block — TypeScript will flag any missing ones. Keys that need language-specific content:

| Key | Notes |
|---|---|
| `announceHeading` / `announceSubtext` / `announceShareText` | Must mention all supported languages, not just the new one. Also update existing language blocks to include the new language name. |
| `sermonCountNote` | Inline note shown under the language pill. Use `""` to hide it (EN pattern). For a partial corpus, show the count: *"X de ~1,200 sermones indexados en …"* |
| All `group*` keys | Sidebar history group labels ("Today", "Yesterday", etc.) — translate each. |
| `untitledConversation` | Fallback title shown in the sidebar when a conversation has no title yet. |
| `guestHeading` / `guestSubtext` | Anonymous banner copy. |
| `signUp` / `logIn` / `signOut` / `signingOut` | Auth action labels in the sidebar and banner. |

### B. Language pill — `ChatShell.tsx`

Add the new language to `CHAT_LANG_OPTIONS` (around line 1308):

```ts
{ code: "pt", label: "Português", flag: "🇧🇷" },
```

Also update the user-language whitelist in `handleSendMessage` (two places):

```ts
if (!isAnonymous && lang && ["en", "es", "fr", "pt"].includes(lang)) {
```

And the `seo_followup` language guard (same file):

```ts
if (parsed.language && ["en", "es", "fr", "pt"].includes(parsed.language)) {
```

### C. Answer-prefix stripping — `src/lib/utils/answerDedup.ts`

`stripAnswerPrefix` runs on every streamed delta and on the final answer. If the API emits *"Resposta:"* (PT) or an equivalent prefix, the regex must cover it or users will see the raw prefix in the chat bubble:

```ts
const ANSWER_PREFIX = /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Answer|Respuesta|R[eé]ponse|Resposta):?(?:\*{1,2})?:?\s*/i;
```

### D. Evidence label — `src/lib/markdown/citations.ts`

`EVIDENCE_PREFIX_RE` must include the new language's equivalent of "Evidence:". Update the capturing-group regex:

```ts
const EVIDENCE_PREFIX_RE = /(Evidence|Evidencia|Preuve|Evidência):/g;
```

Also update `EVIDENCE_ROW_RE` which matches the word to split citation rows:

```ts
/(?:Evidence|Evidencia|Preuve|Evidência)/
```

### E. SEO pages

1. **Route validation** in `src/app/(app)/[lang]/faq/page.tsx` and `[lang]/q/[slug]/page.tsx`:
   ```ts
   const SUPPORTED_LANGS = ["es", "fr", "pt"] as const;
   ```

2. **`generateStaticParams`** in both files — add `{ lang: "pt" }`.

3. **Auto-redirect** in `src/app/(app)/faq/page.tsx` and `q/[slug]/page.tsx`:
   ```ts
   if (lang === "pt") redirect("/pt/faq");
   ```

4. **`LangSwitcher` hrefs** — pass `pt` href to the component wherever it is rendered.

5. **Sitemap** (`src/app/sitemap.ts`) — add `pt` to the langs loop.

6. **Population script** (`scripts/populate-faq-translations.ts`) — add `"pt"` to `TARGET_LANGS`.

### F. Metadata & discoverability

- **`/chat` page metadata** (`src/app/(app)/chat/page.tsx`) — add PT keywords and update the sr-only body paragraph.
- **`/llms.txt`** (`src/app/llms.txt/route.ts`) — add a bullet under "Supported Languages" with the corpus count and URL prefix.
- **`LangAnnounceBanner`** — the share text already pulls from `chatStrings` dynamically; only the `announceHeading` / `announceSubtext` keys per language need updating.

### G. Corpus prerequisite

The language only becomes useful once the Model API is serving answers in it. Confirm with the backend that `user_language: "pt"` is accepted and returns answers in the target language before flipping it on in the frontend. The population script must also succeed for the SEO pages to have content.

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