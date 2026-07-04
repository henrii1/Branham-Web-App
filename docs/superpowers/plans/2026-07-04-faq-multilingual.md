# FAQ Multilingual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spanish (`/es/`) and French (`/fr/`) versions of the `/faq` and `/q/[slug]` pages, with hreflang SEO annotations, a language switcher UI, and auto-redirect for logged-in users based on their profile language.

**Architecture:** A `[lang]` dynamic segment at `src/app/[lang]/` (same level as `/faq` and `/q`) handles ES/FR routes; named segments take Next.js priority so existing routes are unaffected. Existing `/faq` and `/q/[slug]` pages gain a server-side redirect + language switcher. A one-time TypeScript script populates `seo_cache` with ES/FR rows by calling the Model API with each EN row's `robust_query` field.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (postgres + anon/service-role keys), `tsx` for the population script, Tailwind CSS v4, Cloudflare Workers via OpenNext.

**Spec:** `docs/superpowers/specs/2026-07-04-faq-multilingual-design.md`

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/006_seo_cache_composite_pk.sql` | **Create** | Change slug PK → composite (slug, language) |
| `src/lib/db/seo-queries.ts` | **Edit** | Add language param to 3 functions |
| `src/app/sitemap.ts` | **Edit** | Update fetchAllPublishedSeoPages call + add ES/FR URLs |
| `src/components/seo/LangSwitcher.tsx` | **Create** | Globe icon + dropdown language switcher |
| `src/components/seo/SeoShell.tsx` | **Edit** | Add language + langHrefs props; wire data-message-lang + LangSwitcher |
| `src/app/faq/page.tsx` | **Edit** | Auto-redirect + LangSwitcher in header |
| `src/app/q/[slug]/page.tsx` | **Edit** | Auto-redirect + pass language/langHrefs to SeoShell |
| `src/app/[lang]/faq/page.tsx` | **Create** | ES/FR FAQ list page |
| `src/app/[lang]/q/[slug]/page.tsx` | **Create** | ES/FR question page |
| `scripts/populate-faq-translations.ts` | **Create** | One-time population script |

---

## Task 1: DB Migration — Composite Primary Key

**Files:**
- Create: `supabase/migrations/006_seo_cache_composite_pk.sql`

- [ ] **Step 1: Write the migration**

Create the file with this exact content:

```sql
-- Change seo_cache primary key from slug alone to (slug, language)
-- so one question slug can have rows for multiple languages.
-- All existing rows already have language = 'en' and are unaffected.

ALTER TABLE public.seo_cache DROP CONSTRAINT seo_cache_pkey;
ALTER TABLE public.seo_cache ADD PRIMARY KEY (slug, language);
```

- [ ] **Step 2: Apply the migration via Supabase dashboard**

Go to your Supabase project → SQL Editor → run the migration SQL above. Confirm the `seo_cache` table now has a composite PK on `(slug, language)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_seo_cache_composite_pk.sql
git commit -m "feat(db): composite PK (slug, language) on seo_cache"
```

---

## Task 2: Update Query Layer

**Files:**
- Modify: `src/lib/db/seo-queries.ts`

- [ ] **Step 1: Add `language` parameter to the three query functions**

Replace the three functions (`fetchSeoPage`, `fetchAllPublishedSeoPages`, `fetchAdjacentSeoPages`) with language-aware versions. Open `src/lib/db/seo-queries.ts` and make these changes:

`fetchSeoPage` — change signature from `(slug: string)` to `(slug: string, language = "en")`:
```ts
export async function fetchSeoPage(
  slug: string,
  language = "en",
): Promise<SeoCacheRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("slug", slug)
    .eq("language", language)
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
```

`fetchAllPublishedSeoPages` — change signature from `()` to `(language = "en")`:
```ts
export async function fetchAllPublishedSeoPages(language = "en"): Promise<SeoCacheRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("published", true)
    .eq("language", language)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
```

`fetchAdjacentSeoPages` — change signature from `(slug: string)` to `(slug: string, language = "en")`:
```ts
export async function fetchAdjacentSeoPages(slug: string, language = "en"): Promise<{
  prev: AdjacentSeoPage | null;
  next: AdjacentSeoPage | null;
}> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select("slug, question")
    .eq("published", true)
    .eq("language", language)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const pages = (data ?? []) as AdjacentSeoPage[];
  const idx = pages.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx < pages.length - 1 ? pages[idx + 1] : null,
  };
}
```

All existing call sites that pass no language argument continue to default to `"en"` — no other files break.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/seo-queries.ts
git commit -m "feat(db): add language param to seo-queries (defaults to 'en')"
```

---

## Task 3: LangSwitcher Component

**Files:**
- Create: `src/components/seo/LangSwitcher.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

interface LangSwitcherProps {
  current: "en" | "es" | "fr";
  hrefs: { en: string; es: string; fr: string };
}

export function LangSwitcher({ current, hrefs }: LangSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Switch language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 1 0 20M12 2a14.5 14.5 0 0 0 0 20M2 12h20" />
        </svg>
        <span>{current.toUpperCase()}</span>
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {(["en", "es", "fr"] as const).map((lang) => {
            const isActive = lang === current;
            return isActive ? (
              <div
                key={lang}
                className="flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                <span>{LANG_LABELS[lang]}</span>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
            ) : (
              <Link
                key={lang}
                href={hrefs[lang]}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {LANG_LABELS[lang]}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/LangSwitcher.tsx
git commit -m "feat(seo): LangSwitcher globe dropdown component"
```

---

## Task 4: Update SeoShell — language prop + LangSwitcher

**Files:**
- Modify: `src/components/seo/SeoShell.tsx`

SeoShell needs two additions:
1. A `language` prop so it can stamp `data-message-lang` on the answer wrapper (so citation-pill reference lookups use the right language corpus).
2. A `langHrefs` prop passed through to `LangSwitcher` in the mobile header.

- [ ] **Step 1: Add new props to the interface and destructure them**

Find the `SeoShellProps` interface (around line 33) and add two fields:

```ts
interface SeoShellProps {
  slug: string;
  question: string;
  answerMarkdown: string;
  ragContext: string;
  conversationSummary: string | null;
  nextPage: { slug: string; question: string } | null;
  language: string;
  langHrefs: { en: string; es: string; fr: string };
}
```

Find the `export function SeoShell({` destructure (around line 53) and add the two new props:

```ts
export function SeoShell({
  slug,
  question,
  answerMarkdown,
  ragContext,
  conversationSummary,
  nextPage,
  language,
  langHrefs,
}: SeoShellProps) {
```

- [ ] **Step 2: Add the LangSwitcher import**

At the top of the file, add the import alongside the other seo component imports:

```ts
import { LangSwitcher } from "./LangSwitcher";
```

- [ ] **Step 3: Add LangSwitcher to the mobile header**

Find the mobile header section (around line 474). Inside the top `<div className="flex items-center justify-between gap-3 px-3 py-2.5">`, add `LangSwitcher` between the hamburger button and `BrandLogo`:

```tsx
<div className="flex items-center justify-between gap-3 px-3 py-2.5">
  <button
    type="button"
    onClick={openMobileDrawer}
    className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    aria-label="Open menu"
  >
    {/* hamburger SVG — unchanged */}
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  </button>

  <BrandLogo href="/" size={30} nameClassName="text-sm" />

  <LangSwitcher current={language as "en" | "es" | "fr"} hrefs={langHrefs} />
</div>
```

(Remove the existing `<Link href="/faq">Popular Questions</Link>` from this row — it's still present in the desktop sources panel header.)

- [ ] **Step 4: Add LangSwitcher to the desktop chat area header**

Find the desktop chat area div (around line 596). Add a small flex row above the `<h1>` to show the switcher right-aligned:

```tsx
<div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-5 py-6 xl:max-w-[56rem]">
  <div className="mb-4 flex items-start justify-between gap-4">
    <h1 className="font-display text-2xl text-foreground lg:text-3xl">
      {question}
    </h1>
    <div className="shrink-0 pt-1">
      <LangSwitcher current={language as "en" | "es" | "fr"} hrefs={langHrefs} />
    </div>
  </div>
  <TypewriterRenderer markdown={answerMarkdown} />
  <NextQuestionLink nextPage={nextPage} />
</div>
```

- [ ] **Step 5: Add `data-message-lang` to both TypewriterRenderer wrappers**

The `TypewriterRenderer` renders citation pills. The `ReferencePopover` walks up the DOM looking for `[data-message-lang]`. Wrap both TypewriterRenderer instances (desktop ~line 600, mobile ~line 639) with a div that carries the attribute.

Desktop (inside the new `flex-col` div after the h1 row):
```tsx
<div data-message-lang={language}>
  <TypewriterRenderer markdown={answerMarkdown} />
</div>
```

Mobile (inside the mobile answer panel div):
```tsx
<div data-message-lang={language}>
  <TypewriterRenderer markdown={answerMarkdown} />
</div>
```

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/seo/SeoShell.tsx
git commit -m "feat(seo): add language prop + LangSwitcher + data-message-lang to SeoShell"
```

---

## Task 5: Update English FAQ Page

**Files:**
- Modify: `src/app/faq/page.tsx`

- [ ] **Step 1: Add imports at the top of the file**

Add these imports alongside the existing ones:

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
```

- [ ] **Step 2: Add auto-redirect at the top of FaqPage**

Inside `export default async function FaqPage()`, add the redirect block **before** `fetchAllPublishedSeoPages()`:

```ts
export default async function FaqPage() {
  // Auto-redirect logged-in users to their profile language version.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", user.id)
      .maybeSingle();
    const lang = profile?.language;
    if (lang === "es") redirect("/es/faq");
    if (lang === "fr") redirect("/fr/faq");
  }

  const pages = await fetchAllPublishedSeoPages();
  // ... rest unchanged
```

- [ ] **Step 3: Add LangSwitcher to the header**

Find the existing header `<div className="mx-auto flex max-w-4xl items-center justify-between ...">`. Replace the right-side `<Link>` with a flex wrapper:

```tsx
<div className="flex items-center gap-2">
  <LangSwitcher
    current="en"
    hrefs={{ en: "/faq", es: "/es/faq", fr: "/fr/faq" }}
  />
  <Link
    href="/chat"
    className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
  >
    Ask a question
  </Link>
</div>
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/faq/page.tsx
git commit -m "feat(faq): auto-redirect by profile language + LangSwitcher"
```

---

## Task 6: Update English Q/[slug] Page

**Files:**
- Modify: `src/app/q/[slug]/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
```

- [ ] **Step 2: Add auto-redirect at the top of SeoQuestionPage**

Inside `export default async function SeoQuestionPage({ params }: PageProps)`, add the redirect block before the data fetches:

```ts
export default async function SeoQuestionPage({ params }: PageProps) {
  const { slug } = await params;

  // Auto-redirect logged-in users to their profile language version.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", user.id)
      .maybeSingle();
    const lang = profile?.language;
    if (lang === "es") redirect(`/es/q/${slug}`);
    if (lang === "fr") redirect(`/fr/q/${slug}`);
  }

  const [page, adjacent] = await Promise.all([
    fetchSeoPage(slug),
    fetchAdjacentSeoPages(slug),
  ]);
  // ... rest unchanged
```

- [ ] **Step 3: Pass language and langHrefs to SeoShell**

Find the `<SeoShell` JSX at the bottom of the page. Add the two new props:

```tsx
<SeoShell
  slug={slug}
  question={page.question}
  answerMarkdown={page.answer_markdown}
  ragContext={page.rag_context}
  conversationSummary={page.conversation_summary}
  nextPage={adjacent.next}
  language={page.language ?? "en"}
  langHrefs={{
    en: `/q/${slug}`,
    es: `/es/q/${slug}`,
    fr: `/fr/q/${slug}`,
  }}
/>
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/q/[slug]/page.tsx
git commit -m "feat(seo): auto-redirect + language props on /q/[slug]"
```

---

## Task 7: New [lang]/faq Page

**Files:**
- Create: `src/app/[lang]/faq/page.tsx`

> **Note:** `/faq` lives at `src/app/faq/`. Create `src/app/[lang]/faq/page.tsx` at that same root level — not inside `(app)`. Named segments (`faq`, `q`, `chat`, etc.) take Next.js priority over `[lang]`, so existing routes are unaffected.

- [ ] **Step 1: Create the file**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { fetchAllPublishedSeoPages } from "@/lib/db/seo-queries";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import { LangSwitcher } from "@/components/seo/LangSwitcher";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_META: Record<SupportedLang, { title: string; description: string; label: string }> = {
  es: {
    title: "Preguntas frecuentes sobre el Hno. Branham | Branham Sermons Assistant",
    description:
      "Preguntas comunes sobre las doctrinas, sermones, biografía y creencias de William Marrion Branham, respondidas desde los textos originales de los sermones.",
    label: "Preguntas frecuentes",
  },
  fr: {
    title: "Questions fréquentes sur Frère Branham | Branham Sermons Assistant",
    description:
      "Questions courantes sur les doctrines, sermons, biographie et croyances de William Marrion Branham, répondues à partir des textes originaux des sermons.",
    label: "Questions fréquentes",
  },
};

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const l = lang as SupportedLang;
  const meta = LANG_META[l];
  return {
    title: { absolute: meta.title },
    description: meta.description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${SITE_URL}/${l}/faq`,
      languages: {
        en: `${SITE_URL}/faq`,
        es: `${SITE_URL}/es/faq`,
        fr: `${SITE_URL}/fr/faq`,
        "x-default": `${SITE_URL}/faq`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}/${l}/faq`,
      type: "website",
      images: [{ url: OG_IMAGE }],
      siteName: "Branham Sermons Assistant",
    },
  };
}

function stripMarkdownToPlain(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getExcerpt(md: string, sentenceCount = 3): string {
  const plain = stripMarkdownToPlain(md);
  const sentences = plain.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return plain.slice(0, 200);
  return sentences.slice(0, sentenceCount).join(" ").trim();
}

export default async function LocalizedFaqPage({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;

  const pages = await fetchAllPublishedSeoPages(l);
  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    excerpt: getExcerpt(p.answer_markdown),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: l,
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.excerpt },
    })),
  };

  const langHrefs = { en: "/faq", es: "/es/faq", fr: "/fr/faq" };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 xl:max-w-[56rem]">
            <BrandLogo href="/" priority />
            <div className="flex items-center gap-2">
              <LangSwitcher current={l} hrefs={langHrefs} />
              <Link
                href="/chat"
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Ask a question
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-10 xl:max-w-[56rem]">
            <h1 className="font-display mb-2 text-3xl text-foreground lg:text-4xl">
              {LANG_META[l].label}
            </h1>
            <p className="mb-8 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              Common questions about the sermons and teachings of William Marrion
              Branham, answered from the original sermon texts.
            </p>

            <nav className="sr-only" aria-label="All questions">
              {faqItems.map((item) => (
                <Link key={item.slug} href={`/${l}/q/${item.slug}`}>
                  {item.question}
                </Link>
              ))}
            </nav>

            <FaqAccordion items={faqItems} slugPrefix={`/${l}/q`} />

            <div className="mt-10 rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] px-5 py-4 shadow-sm dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Need help or want to share feedback? Email{" "}
                <a
                  href="mailto:info@branhamsermons.ai"
                  className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600"
                >
                  info@branhamsermons.ai
                </a>
                .
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
```

> **Important:** The `FaqAccordion` component currently links items to `/q/${slug}`. The localized page needs links to `/${lang}/q/${slug}`. In the next step you'll add a `slugPrefix` prop to `FaqAccordion`. For now this file is the correct target shape.

- [ ] **Step 2: Check FaqAccordion's current link format**

```bash
grep -n "href\|slug" /Users/emeraldhenry/Branham-Web-App/src/components/seo/FaqAccordion.tsx
```

- [ ] **Step 3: Add `slugPrefix` prop to FaqAccordion**

Open `src/components/seo/FaqAccordion.tsx`. Find where it renders the link to the individual question page (likely something like `href={\`/q/${item.slug}\`}`). Add an optional `slugPrefix` prop defaulting to `/q`:

```tsx
interface FaqAccordionProps {
  items: { slug: string; question: string; excerpt: string }[];
  slugPrefix?: string;
}

export function FaqAccordion({ items, slugPrefix = "/q" }: FaqAccordionProps) {
  // Replace any href={`/q/${item.slug}`} with href={`${slugPrefix}/${item.slug}`}
}
```

The existing English `/faq/page.tsx` call `<FaqAccordion items={faqItems} />` continues to work because `slugPrefix` defaults to `"/q"`.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/[lang]/faq/page.tsx src/components/seo/FaqAccordion.tsx
git commit -m "feat(seo): localized /[lang]/faq page + FaqAccordion slugPrefix prop"
```

---

## Task 8: New [lang]/q/[slug] Page

**Files:**
- Create: `src/app/[lang]/q/[slug]/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchAdjacentSeoPages,
  fetchAllPublishedSeoPages,
  fetchSeoPage,
} from "@/lib/db/seo-queries";
import { SeoShell } from "@/components/seo/SeoShell";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateStaticParams() {
  const results: { lang: string; slug: string }[] = [];
  for (const lang of SUPPORTED_LANGS) {
    const pages = await fetchAllPublishedSeoPages(lang);
    for (const page of pages) {
      results.push({ lang, slug: page.slug });
    }
  }
  return results;
}

function stripMarkdownToPlain(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const l = lang as SupportedLang;

  const page = await fetchSeoPage(slug, l);
  if (!page) return { title: "Not Found" };

  const title = page.meta_title || `${page.question} | Branham Sermons Assistant`;
  const description =
    page.meta_description || stripMarkdownToPlain(page.answer_markdown).slice(0, 155);
  const canonicalUrl = `${SITE_URL}/${l}/q/${slug}`;

  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${SITE_URL}/q/${slug}`,
        es: `${SITE_URL}/es/q/${slug}`,
        fr: `${SITE_URL}/fr/q/${slug}`,
        "x-default": `${SITE_URL}/q/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: [{ url: OG_IMAGE }],
      siteName: "Branham Sermons Assistant",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

export default async function LocalizedSeoQuestionPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;

  const [page, adjacent] = await Promise.all([
    fetchSeoPage(slug, l),
    fetchAdjacentSeoPages(slug, l),
  ]);

  if (!page) notFound();

  const canonicalUrl = `${SITE_URL}/${l}/q/${slug}`;
  const prevUrl = adjacent.prev ? `${SITE_URL}/${l}/q/${adjacent.prev.slug}` : null;
  const nextUrl = adjacent.next ? `${SITE_URL}/${l}/q/${adjacent.next.slug}` : null;
  const answerPlain = stripMarkdownToPlain(page.answer_markdown);

  const appOrg = { "@type": "Organization", name: "Branham Sermons AI", url: SITE_URL };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.question,
    description: page.meta_description || answerPlain.slice(0, 155),
    articleBody: answerPlain,
    inLanguage: l,
    datePublished: page.created_at,
    dateModified: page.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    image: OG_IMAGE,
    author: appOrg,
    publisher: {
      "@type": "Organization",
      name: "Branham Sermons AI",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 1024, height: 1024 },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/chat` },
      { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE_URL}/${l}/faq` },
      { "@type": "ListItem", position: 3, name: page.question, item: canonicalUrl },
    ],
  };

  const processedAnswer = postprocessChatResponse(page.answer_markdown);
  const ssrAnswerHtml = renderMarkdown(processedAnswer);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
      <div
        className="sr-only"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ssrAnswerHtml }}
      />
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context ?? ""}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={l}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[lang]/q/[slug]/page.tsx"
git commit -m "feat(seo): localized /[lang]/q/[slug] page"
```

---

## Task 9: Update sitemap.ts

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Replace the sitemap file content**

```ts
import type { MetadataRoute } from "next";
import { fetchAllPublishedSeoPages } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [enPages, esPages, frPages] = await Promise.all([
    fetchAllPublishedSeoPages("en"),
    fetchAllPublishedSeoPages("es"),
    fetchAllPublishedSeoPages("fr"),
  ]);

  const enEntries: MetadataRoute.Sitemap = enPages.map((page) => ({
    url: `${SITE_URL}/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const esEntries: MetadataRoute.Sitemap = esPages.map((page) => ({
    url: `${SITE_URL}/es/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const frEntries: MetadataRoute.Sitemap = frPages.map((page) => ({
    url: `${SITE_URL}/fr/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: `${SITE_URL}/chat`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/es/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/fr/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...enEntries,
    ...esEntries,
    ...frEntries,
  ];
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add ES/FR URLs to sitemap"
```

---

## Task 10: Population Script

**Files:**
- Create: `scripts/populate-faq-translations.ts`

- [ ] **Step 1: Create the script**

```ts
/**
 * Populates seo_cache with Spanish and French versions of all published EN rows.
 * Calls the Model API directly with each row's robust_query field.
 *
 * Run: CHAT_API_BEARER_KEY=... MODEL_API_BASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/populate-faq-translations.ts
 *
 * Safe to re-run: skips rows that already exist (idempotent).
 */

import { createClient } from "@supabase/supabase-js";

const MODEL_API_BASE_URL = process.env.MODEL_API_BASE_URL;
const CHAT_API_BEARER_KEY = process.env.CHAT_API_BEARER_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MODEL_API_BASE_URL || !CHAT_API_BEARER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars: MODEL_API_BASE_URL, CHAT_API_BEARER_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_LANGUAGES = ["es", "fr"] as const;

async function fetchFinalAnswer(query: string, language: string): Promise<string> {
  const response = await fetch(`${MODEL_API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHAT_API_BEARER_KEY}`,
    },
    body: JSON.stringify({ query, user_language: language }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalAnswer: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let eventType = "";
    let dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
        dataLines = [];
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line === "" && eventType && dataLines.length > 0) {
        const raw = dataLines.join("\n");
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (eventType === "final" && typeof parsed.answer === "string") {
            finalAnswer = parsed.answer;
          }
        } catch {
          // malformed data line, skip
        }
        eventType = "";
        dataLines = [];
      }
    }
  }

  if (!finalAnswer) throw new Error("No 'final' event with answer received from API");
  return finalAnswer;
}

async function main() {
  // Fetch all published EN rows.
  const { data: enRows, error } = await supabase
    .from("seo_cache")
    .select("slug, question, robust_query")
    .eq("published", true)
    .eq("language", "en")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!enRows || enRows.length === 0) {
    console.log("No published EN rows found.");
    return;
  }

  console.log(`Found ${enRows.length} EN rows. Generating ES and FR versions...\n`);

  for (const row of enRows) {
    for (const lang of TARGET_LANGUAGES) {
      // Check if this (slug, lang) already exists.
      const { data: existing } = await supabase
        .from("seo_cache")
        .select("slug")
        .eq("slug", row.slug)
        .eq("language", lang)
        .maybeSingle();

      if (existing) {
        console.log(`  SKIP  [${lang}] ${row.slug}`);
        continue;
      }

      try {
        process.stdout.write(`  GEN   [${lang}] ${row.slug} ... `);
        const answer = await fetchFinalAnswer(row.robust_query, lang);

        const { error: insertError } = await supabase.from("seo_cache").insert({
          slug: row.slug,
          language: lang,
          question: row.question,
          robust_query: row.robust_query,
          answer_markdown: answer,
          published: true,
        });

        if (insertError) throw insertError;
        console.log("done");
      } catch (err) {
        console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script (you will do this step)**

Source the secrets from `.dev.vars` first:

```bash
# Load vars from .dev.vars (which has MODEL_API_BASE_URL, CHAT_API_BEARER_KEY, etc.)
export $(grep -v '^#' .dev.vars | xargs)
# Also set the service role key (from Supabase dashboard → Settings → API):
export SUPABASE_SERVICE_ROLE_KEY=<paste key>

npx tsx scripts/populate-faq-translations.ts
```

Expected output: lines of `GEN   [es] <slug> ... done` and `GEN   [fr] <slug> ... done` for each EN row, with no ERROR lines. The script is safe to re-run — any already-generated rows will show `SKIP`.

- [ ] **Step 3: Verify rows in Supabase**

In the Supabase dashboard → Table Editor → `seo_cache`: confirm rows exist with `language = 'es'` and `language = 'fr'`. Spot-check one Spanish row's `answer_markdown` to confirm it's in Spanish.

- [ ] **Step 4: Commit**

```bash
git add scripts/populate-faq-translations.ts
git commit -m "feat(scripts): FAQ translation population script"
```

---

## Task 11: Build Verification & Smoke Test

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: build completes with no TypeScript errors. The `[lang]/faq` and `[lang]/q/[slug]` pages will show as static params (if ES/FR rows exist in DB) or as dynamic-only (if not yet populated — that's fine, it still builds).

- [ ] **Step 2: Start dev server and manually verify**

```bash
npm run dev
```

Check the following URLs in the browser:
- `http://localhost:3000/faq` — English FAQ renders with LangSwitcher globe button in header
- `http://localhost:3000/es/faq` — Spanish FAQ renders (404 if script hasn't run yet)
- `http://localhost:3000/fr/faq` — French FAQ renders
- `http://localhost:3000/q/<any-slug>` — English question page renders with LangSwitcher
- `http://localhost:3000/es/q/<any-slug>` — Spanish question page renders
- `http://localhost:3000/fr/q/<any-slug>` — French question page renders
- Click the globe button on `/faq` → dropdown shows English ✓, Español, Français
- Click Español → navigates to `/es/faq`
- View page source of `/es/faq` → check `<link rel="alternate" hreflang="en"` is present
- View page source of `/es/q/<slug>` → check `inLanguage: "es"` in the Article JSON-LD

- [ ] **Step 3: Verify auto-redirect (logged-in user)**

Log in with a test account that has `language = 'es'` in its profile. Visit `http://localhost:3000/faq`. Expected: immediate redirect to `/es/faq` with no English flash.

- [ ] **Step 4: Verify sitemap**

Visit `http://localhost:3000/sitemap.xml`. Expected: contains `/es/faq`, `/fr/faq`, and `/es/q/<slug>` / `/fr/q/<slug>` entries for every translated row.

- [ ] **Step 5: Deploy**

```bash
npm run deploy
```

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(seo): post-build corrections for multilingual FAQ"
```