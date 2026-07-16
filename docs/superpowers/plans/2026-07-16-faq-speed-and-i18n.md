# FAQ Speed & Multilingual Rendering Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FAQ pages fast (lean DB query + 1h cache + card grid), and fix multilingual rendering bugs in the chat and SEO answer pages (ES/FR answer prefix, Evidence label, and chat UI strings).

**Architecture:** Seven independent tasks — FAQ data/component/pages are one group; answer-prefix fix, Evidence-label fix, chat-string file, and chat-string wiring are four more. All can land in order with no cross-task dependencies.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase JS, Tailwind CSS v4, TypeScript, Cloudflare Workers via OpenNext.

## Global Constraints

- No `"use client"` on `FaqGrid` — it must be a server component (pure function, no hooks)
- `unstable_cache` import from `"next/cache"` — not from any other path
- All Tailwind classes must already exist in the project palette (zinc, blue, green, amber); no arbitrary values unless matching existing ones
- `FaqAccordion.tsx` must not be deleted or modified
- Every task ends with `npm run build` passing and a `git commit`
- Latency is a first-class constraint — no new blocking DB calls on any hot path

---

### Task 1: Lean FAQ query with 1-hour cache

**Files:**
- Modify: `src/lib/db/seo-queries.ts`

**Interfaces:**
- Produces: `fetchFaqListItems(language?: string): Promise<Pick<SeoCacheRow, "slug" | "question" | "meta_description">[]>` — exported async function, used by Tasks 3

- [ ] **Step 1: Add `fetchFaqListItems` with `unstable_cache`**

Open `src/lib/db/seo-queries.ts`. Add the import and new function after the existing `fetchUserLanguage`-equivalent imports (after line 33, `SEO_COLUMNS` declaration, before `fetchSeoPage`). The new function goes **after** all existing exports, at the bottom of the file:

```ts
import { unstable_cache } from "next/cache";

// ... existing code unchanged ...

export const fetchFaqListItems = (language = "en") =>
  unstable_cache(
    async () => {
      const supabase = getPublicClient();
      const { data, error } = await supabase
        .from("seo_cache")
        .select("slug, question, meta_description")
        .eq("published", true)
        .eq("language", language)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<
        SeoCacheRow,
        "slug" | "question" | "meta_description"
      >[];
    },
    ["faq-list", language],
    { revalidate: 3600 },
  )();
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/seo-queries.ts
git commit -m "feat(faq): add fetchFaqListItems with 1h unstable_cache"
```

---

### Task 2: FaqGrid server component

**Files:**
- Create: `src/components/seo/FaqGrid.tsx`

**Interfaces:**
- Consumes: `{ slug: string; question: string }[]` items array, optional `slugPrefix` string (default `"/q"`)
- Produces: `FaqGrid` named export — used by Task 3

- [ ] **Step 1: Create `FaqGrid.tsx`**

Create `src/components/seo/FaqGrid.tsx` with this exact content (no `"use client"` — server component):

```tsx
import Link from "next/link";

interface FaqGridProps {
  items: { slug: string; question: string }[];
  slugPrefix?: string;
}

export function FaqGrid({ items, slugPrefix = "/q" }: FaqGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`${slugPrefix}/${item.slug}`}
          className="group flex items-start justify-between rounded-xl border border-zinc-200 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
        >
          <h2 className="pr-3 text-sm font-semibold text-foreground lg:text-base">
            {item.question}
          </h2>
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/seo/FaqGrid.tsx
git commit -m "feat(faq): add FaqGrid server component card grid"
```

---

### Task 3: Wire FAQ pages to lean query and FaqGrid

**Files:**
- Modify: `src/app/faq/page.tsx`
- Modify: `src/app/[lang]/faq/page.tsx`

**Interfaces:**
- Consumes: `fetchFaqListItems` (Task 1), `FaqGrid` (Task 2)

- [ ] **Step 1: Rewrite `src/app/faq/page.tsx`**

Replace the entire file with the following. Key changes: imports `fetchFaqListItems` + `FaqGrid`, drops `fetchAllPublishedSeoPages`, `FaqAccordion`, `getExcerpt`, `stripMarkdownToPlain`. JSON-LD uses `meta_description ?? item.question` as answer text.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { fetchFaqListItems } from "@/lib/db/seo-queries";
import { FaqGrid } from "@/components/seo/FaqGrid";
import { createClient } from "@/lib/supabase/server";
import { LangSwitcher } from "@/components/seo/LangSwitcher";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

export const metadata: Metadata = {
  title: { absolute: "Popular Questions About Bro Branham | Branham Sermons Assistant" },
  description:
    "Explore common questions about the doctrines, sermons, biography, and beliefs of William Marrion Branham — answered from the original sermon texts.",
  keywords: [
    "Branham Sermons Assistant",
    "Branham Sermons AI",
    "Branham Sermons",
    "Branham messages",
    "William Branham Messages",
    "William Branham Doctrines",
    "William Branham Beliefs",
    "Branham",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "Popular Questions About Bro Branham | Branham Sermons Assistant",
    description:
      "Explore common questions about the doctrines, sermons, biography, and beliefs of William Marrion Branham.",
    url: `${SITE_URL}/faq`,
    type: "website",
    images: [{ url: OG_IMAGE }],
    siteName: "Branham Sermons Assistant",
  },
  twitter: {
    card: "summary_large_image",
    title: "Popular Questions About Bro Branham | Branham Sermons Assistant",
    description:
      "Explore common questions about the doctrines, sermons, biography, and beliefs of William Marrion Branham.",
    images: [OG_IMAGE],
  },
};

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const pages = await fetchFaqListItems("en");

  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    metaDescription: p.meta_description,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.metaDescription ?? item.question,
      },
    })),
  };

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
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-10 xl:max-w-[56rem]">
            <h1 className="font-display mb-2 text-3xl text-foreground lg:text-4xl">
              Frequently Asked Questions
            </h1>
            <p className="mb-8 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              Common questions about the sermons and teachings of William Marrion
              Branham, answered from the original sermon texts.
            </p>

            <nav className="sr-only" aria-label="All questions">
              {faqItems.map((item) => (
                <Link key={item.slug} href={`/q/${item.slug}`}>
                  {item.question}
                </Link>
              ))}
            </nav>

            <FaqGrid items={faqItems} />

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

- [ ] **Step 2: Rewrite `src/app/[lang]/faq/page.tsx`**

Replace the entire file with the following. Same changes as above — uses `fetchFaqListItems(l)` and `FaqGrid`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { fetchFaqListItems } from "@/lib/db/seo-queries";
import { FaqGrid } from "@/components/seo/FaqGrid";
import { LangSwitcher } from "@/components/seo/LangSwitcher";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_META: Record<
  SupportedLang,
  { title: string; description: string; label: string; subtitle: string }
> = {
  es: {
    title: "Preguntas frecuentes sobre el Hno. Branham | Branham Sermons Assistant",
    description:
      "Preguntas comunes sobre las doctrinas, sermones, biografía y creencias de William Marrion Branham, respondidas desde los textos originales de los sermones.",
    label: "Preguntas frecuentes",
    subtitle:
      "Preguntas comunes sobre los sermones y enseñanzas de William Marrion Branham, respondidas desde los textos originales de los sermones.",
  },
  fr: {
    title: "Questions fréquentes sur Frère Branham | Branham Sermons Assistant",
    description:
      "Questions courantes sur les doctrines, sermons, biographie et croyances de William Marrion Branham, répondues à partir des textes originaux des sermons.",
    label: "Questions fréquentes",
    subtitle:
      "Questions courantes sur les sermons et enseignements de William Marrion Branham, répondues à partir des textes originaux des sermons.",
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

export default async function LocalizedFaqPage({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;

  const pages = await fetchFaqListItems(l);
  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    metaDescription: p.meta_description,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: l,
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.metaDescription ?? item.question,
      },
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
              {LANG_META[l].subtitle}
            </p>

            <nav className="sr-only" aria-label="All questions">
              {faqItems.map((item) => (
                <Link key={item.slug} href={`/${l}/q/${item.slug}`}>
                  {item.question}
                </Link>
              ))}
            </nav>

            <FaqGrid items={faqItems} slugPrefix={`/${l}/q`} />

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

- [ ] **Step 3: Verify build and lint**

```bash
npm run build 2>&1 | tail -5
npm run lint 2>&1 | grep -E "error|Error" | head -10
```

Expected: clean build, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/faq/page.tsx src/app/\[lang\]/faq/page.tsx
git commit -m "feat(faq): swap to FaqGrid + lean query, fix JSON-LD fallback"
```

---

### Task 4: ES/FR answer prefix stripping

**Files:**
- Modify: `src/lib/utils/answerDedup.ts`
- Modify: `src/components/seo/TypewriterRenderer.tsx`

**Interfaces:**
- `stripAnswerPrefix(text: string): string` — signature unchanged, regex extended

- [ ] **Step 1: Extend regex in `answerDedup.ts`**

Replace the entire file:

```ts
// Strips "Answer:" / "Respuesta:" / "Réponse:" and markdown-decorated variants
// at the start of text: **Answer:**, ## Answer:, *Respuesta:*, etc.
const ANSWER_PREFIX =
  /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Answer|Respuesta|R[eé]ponse):?(?:\*{1,2})?:?\s*/i;

export function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "").trimStart();
}
```

- [ ] **Step 2: Apply strip in `TypewriterRenderer.tsx`**

Add the import and apply `stripAnswerPrefix` before splitting into chunks. Change lines 4-6 (imports) and line 31 (useEffect body):

```tsx
// Add to imports (after existing imports):
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";
```

Then on the line inside `useEffect` that reads:
```tsx
chunks.current = splitIntoChunks(markdown);
```

Change to:
```tsx
chunks.current = splitIntoChunks(stripAnswerPrefix(markdown));
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/answerDedup.ts src/components/seo/TypewriterRenderer.tsx
git commit -m "fix(i18n): strip Respuesta/Réponse prefix in chat + SEO answer render"
```

---

### Task 5: Evidence label ES/FR

**Files:**
- Modify: `src/lib/markdown/citations.ts`

**Interfaces:**
- `applyCitations(html: string): string` — signature unchanged, now handles ES/FR evidence labels

- [ ] **Step 1: Update `EVIDENCE_PREFIX_RE` (line 33)**

Change:
```ts
const EVIDENCE_PREFIX_RE = /Evidence:/g;
```
To:
```ts
const EVIDENCE_PREFIX_RE = /(Evidence|Evidencia|Preuve):/g;
```

- [ ] **Step 2: Update `EVIDENCE_ROW_RE` (line 38-39)**

Change the hard-coded `Evidence` in the HTML pattern to a non-capturing alternation:
```ts
const EVIDENCE_ROW_RE =
  /(<span class="evidence-label">(?:Evidence|Evidencia|Preuve)<\/span>(?:\s|&nbsp;)*<span class="citation-pill[^"]*"[^>]*>\[[\s\S]*?<\/span>(?:(?:<span class="citation-separator">[;,]<\/span>)?\s*<span class="citation-pill[^"]*"[^>]*>\[[\s\S]*?<\/span>)*)(\s*[.;,])?/g;
```

- [ ] **Step 3: Update `makeEvidenceLabel` (line 176-178)**

Change to accept the matched word:
```ts
function makeEvidenceLabel(word: string): string {
  return `<span class="evidence-label">${word}</span>`;
}
```

- [ ] **Step 4: Update `applyCitations` step 2 (line 192)**

Change:
```ts
result = result.replace(EVIDENCE_PREFIX_RE, makeEvidenceLabel());
```
To:
```ts
result = result.replace(EVIDENCE_PREFIX_RE, (_match, word: string) => makeEvidenceLabel(word));
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/lib/markdown/citations.ts
git commit -m "fix(i18n): style Evidencia/Preuve labels same as English Evidence"
```

---

### Task 6: Chat UI string translations file

**Files:**
- Create: `src/lib/i18n/chatStrings.ts`

**Interfaces:**
- Produces: `getChatStrings(lang: string): ChatStrings` and `type ChatStrings` — used by Task 7

- [ ] **Step 1: Create `src/lib/i18n/chatStrings.ts`**

```ts
const CHAT_STRINGS = {
  en: {
    welcomeDescription:
      "Ask questions about the sermons of William Marrion Branham. Your answers are grounded in the original sermon texts.",
    passagesTitle: "Passages",
    passagesDescription:
      "Sermon passages retrieved for your question will appear here. For the most relevant results, ask one topic per chat.",
    passagesSectionHeader: "Sermon Passages",
    switchingTopics: "Switching topics?",
    startNewChat: "Start a new chat",
    forMorePassages: "for more relevant passages.",
    viewPassages: "View passages",
    backToAnswer: "Back to answer",
    respondingIn: "Responding in",
    popularQuestions: "Popular Questions",
    chatTab: "Chat",
    passagesTab: "Passages",
    finalizingResponse: "Finalizing response…",
    askPlaceholder: "Ask a question…",
    waitingPlaceholder: "Waiting for response…",
  },
  es: {
    welcomeDescription:
      "Haga preguntas sobre los sermones de William Marrion Branham. Sus respuestas se basan en los textos originales de los sermones.",
    passagesTitle: "Pasajes",
    passagesDescription:
      "Los pasajes de sermones recuperados para su pregunta aparecerán aquí. Para obtener los resultados más relevantes, pregunte sobre un tema por chat.",
    passagesSectionHeader: "Pasajes de Sermones",
    switchingTopics: "¿Cambiando de tema?",
    startNewChat: "Inicie un nuevo chat",
    forMorePassages: "para pasajes más relevantes.",
    viewPassages: "Ver pasajes",
    backToAnswer: "Volver a la respuesta",
    respondingIn: "Respondiendo en",
    popularQuestions: "Preguntas populares",
    chatTab: "Chat",
    passagesTab: "Pasajes",
    finalizingResponse: "Finalizando respuesta…",
    askPlaceholder: "Haga una pregunta…",
    waitingPlaceholder: "Esperando respuesta…",
  },
  fr: {
    welcomeDescription:
      "Posez des questions sur les sermons de William Marrion Branham. Vos réponses sont fondées sur les textes originaux des sermons.",
    passagesTitle: "Passages",
    passagesDescription:
      "Les passages de sermons récupérés pour votre question apparaîtront ici. Pour des résultats plus pertinents, posez une question par chat.",
    passagesSectionHeader: "Passages de Sermons",
    switchingTopics: "Vous changez de sujet ?",
    startNewChat: "Commencer un nouveau chat",
    forMorePassages: "pour des passages plus pertinents.",
    viewPassages: "Voir les passages",
    backToAnswer: "Retour à la réponse",
    respondingIn: "Répondre en",
    popularQuestions: "Questions populaires",
    chatTab: "Chat",
    passagesTab: "Passages",
    finalizingResponse: "Finalisation de la réponse…",
    askPlaceholder: "Posez une question…",
    waitingPlaceholder: "En attente de réponse…",
  },
} as const;

type ChatLang = keyof typeof CHAT_STRINGS;
export type ChatStrings = (typeof CHAT_STRINGS)[ChatLang];

export function getChatStrings(lang: string): ChatStrings {
  return CHAT_STRINGS[lang as ChatLang] ?? CHAT_STRINGS.en;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/chatStrings.ts
git commit -m "feat(i18n): add EN/ES/FR chat UI string translations"
```

---

### Task 7: Wire chat strings into all chat components

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/chat/SourcesPanel.tsx`
- Modify: `src/components/chat/Composer.tsx`
- Modify: `src/components/chat/MessageList.tsx`
- Modify: `src/components/chat/ChatShell.tsx`

**Interfaces:**
- Consumes: `getChatStrings`, `ChatStrings` from Task 6

- [ ] **Step 1: Update `ChatPanel.tsx`**

Add `welcomeDescription` to props; pass it into `WelcomeState`:

```tsx
// Add to ChatPanelProps interface:
interface ChatPanelProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  error: string | null;
  isLoading?: boolean;
  welcomeDescription: string;
}

// Change WelcomeState to accept it:
function WelcomeState({ description }: { description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="max-w-lg rounded-[28px] border border-zinc-200 bg-[var(--surface-base)] px-8 py-10 text-center shadow-sm dark:border-zinc-700">
        <Image
          src={logo}
          alt="Branham Sermons Assistant logo"
          width={76}
          height={76}
          priority
          className="mx-auto mb-5 rounded-2xl object-cover shadow-sm"
        />
        <h2 className="font-display mb-3 text-3xl text-foreground">
          Branham Sermons Assistant
        </h2>
        <p className="text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

// In ChatPanel function, destructure welcomeDescription and pass to WelcomeState:
export function ChatPanel({
  messages,
  streamingStatus,
  streamBuffer,
  error,
  isLoading,
  welcomeDescription,
}: ChatPanelProps) {
  const isEmpty =
    messages.length === 0 && streamingStatus === "idle" && !isLoading;

  return (
    <div className="flex h-full flex-col bg-[var(--surface-chat)]">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 lg:hidden dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Chat
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : isEmpty ? (
          <WelcomeState description={welcomeDescription} />
        ) : (
          <MessageList
            messages={messages}
            streamingStatus={streamingStatus}
            streamBuffer={streamBuffer}
          />
        )}
      </div>

      {error && <ErrorBanner error={error} />}
    </div>
  );
}
```

- [ ] **Step 2: Update `SourcesPanel.tsx`**

Add string props; update `EmptyState` and section header:

```tsx
// Update SourcesPanelProps:
interface SourcesPanelProps {
  ragData: RagData | null;
  streamingStatus: StreamingStatus;
  passagesTitle: string;
  passagesDescription: string;
  passagesSectionHeader: string;
}

// Update EmptyState to accept strings:
function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="max-w-sm rounded-[24px] border border-zinc-200 bg-[var(--surface-base)] px-6 py-7 text-center shadow-sm dark:border-zinc-700">
        <svg
          className="mx-auto mb-3 h-9 w-9 text-zinc-400 dark:text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
        <p className="font-display text-xl text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

// Update SourcesPanel export to use new props:
export function SourcesPanel({
  ragData,
  streamingStatus,
  passagesTitle,
  passagesDescription,
  passagesSectionHeader,
}: SourcesPanelProps) {
  const isLoading = streamingStatus === "connecting";
  const hasNoContent = !ragData && streamingStatus === "idle";

  const renderedHtml = useMemo(() => {
    if (!ragData) return "";
    const cleaned = postprocessRag(ragData.ragContext);
    return renderMarkdown(cleaned);
  }, [ragData]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-sources)]">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {passagesSectionHeader}
        </h2>
        {ragData && (
          <span className="ml-2 inline-flex h-4 items-center rounded-full bg-green-100 px-1.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Available
          </span>
        )}
      </div>
      {/* Keep the rest of SourcesPanel's JSX unchanged — only the EmptyState call changes: */}
      {/* Replace the EmptyState call with: */}
      {/* <EmptyState title={passagesTitle} description={passagesDescription} /> */}
    </div>
  );
}
```

> **Note:** Only the `EmptyState` invocation and `passagesSectionHeader` heading change. All other JSX inside `SourcesPanel` (loading state, rendered HTML block, etc.) stays unchanged. Find the existing `<EmptyState />` call in the file and change it to `<EmptyState title={passagesTitle} description={passagesDescription} />`.

- [ ] **Step 3: Update `Composer.tsx`**

Add `placeholder` and `waitingPlaceholder` props:

```tsx
// Update ComposerProps:
interface ComposerProps {
  onSend: (content: string) => void;
  disabled: boolean;
  streamingStatus: StreamingStatus;
  placeholder?: string;
  waitingPlaceholder?: string;
}

// Update the destructure:
export function Composer({
  onSend,
  disabled,
  streamingStatus,
  placeholder = "Ask a question…",
  waitingPlaceholder = "Waiting for response…",
}: ComposerProps) {
```

Then find the textarea `placeholder` prop (currently line 99-101) and change it to:
```tsx
placeholder={isStreaming ? waitingPlaceholder : placeholder}
```

- [ ] **Step 4: Update `MessageList.tsx`**

Add `finalizingText` prop to `StreamingIndicator` and `MessageList`:

```tsx
// Update MessageListProps:
interface MessageListProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  finalizingText?: string;
}

// Update StreamingIndicator to accept the string:
function StreamingIndicator({
  status,
  finalizingText = "Finalizing response…",
}: {
  status: StreamingStatus;
  finalizingText?: string;
}) {
  // ... connecting dots unchanged ...

  if (status === "rag_received") {
    return (
      <div className="py-2">
        <p className="animate-pulse text-sm text-zinc-400 dark:text-zinc-500">
          {finalizingText}
        </p>
      </div>
    );
  }

  return null;
}
```

Then find where `<StreamingIndicator status={streamingStatus} />` is rendered in `MessageList` and pass the prop through:
```tsx
// In MessageList export function, add finalizingText to destructure:
export function MessageList({
  messages,
  streamingStatus,
  streamBuffer,
  finalizingText,
}: MessageListProps) {
  // ... find StreamingIndicator usage and update to:
  // <StreamingIndicator status={streamingStatus} finalizingText={finalizingText} />
```

- [ ] **Step 5: Update `ChatShell.tsx`**

This is the orchestration step. Import `getChatStrings`, compute strings from `chatLanguage`, pass down to all child components, and update inline strings.

**5a — Add import** (near the top with other lib imports):
```ts
import { getChatStrings } from "@/lib/i18n/chatStrings";
```

**5b — Compute strings in the render function** (just before the `return` statement in the main `ChatShell` component, after all hooks):
```tsx
const strings = getChatStrings(chatLanguage);
const faqHref = chatLanguage === "en" ? "/faq" : `/${chatLanguage}/faq`;
```

**5c — Update every `<ChatPanel>` call** (there are two — one in desktop layout, one in mobile). Add `welcomeDescription`:
```tsx
<ChatPanel
  messages={messages}
  streamingStatus={streamingStatus}
  streamBuffer={streamBuffer}
  error={error}
  isLoading={conversationLoading}
  welcomeDescription={strings.welcomeDescription}
/>
```

**5d — Update every `<SourcesPanel>` call** (there are two). Add three string props:
```tsx
<SourcesPanel
  ragData={ragData}
  streamingStatus={streamingStatus}
  passagesTitle={strings.passagesTitle}
  passagesDescription={strings.passagesDescription}
  passagesSectionHeader={strings.passagesSectionHeader}
/>
```

**5e — Update `<Composer>` call**:
```tsx
<Composer
  onSend={handleSendMessage}
  disabled={false}
  streamingStatus={streamingStatus}
  placeholder={strings.askPlaceholder}
  waitingPlaceholder={strings.waitingPlaceholder}
/>
```

**5f — Update `<MessageList>` calls** (find in ChatShell — actually MessageList is rendered inside ChatPanel, not directly in ChatShell; it receives `finalizingText` via ChatPanel → MessageList). Add `finalizingText` to `ChatPanelProps` and thread it through in ChatPanel from Step 1, then pass it from ChatShell:

Update `ChatPanelProps` in `ChatPanel.tsx` to also include `finalizingText`:
```tsx
interface ChatPanelProps {
  // ... existing ...
  welcomeDescription: string;
  finalizingText: string;
}
```

Pass it through inside ChatPanel to MessageList:
```tsx
<MessageList
  messages={messages}
  streamingStatus={streamingStatus}
  streamBuffer={streamBuffer}
  finalizingText={finalizingText}
/>
```

And from ChatShell into each `<ChatPanel>`:
```tsx
<ChatPanel
  // ... existing ...
  welcomeDescription={strings.welcomeDescription}
  finalizingText={strings.finalizingResponse}
/>
```

**5g — Update the "Switching topics?" nudge** (around line 1228):
```tsx
{messages.length > 0 && (
  <div className="bg-[var(--surface-base)] px-4 pb-1.5 pt-1 text-center">
    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
      {strings.switchingTopics}{" "}
      <button
        type="button"
        onClick={handleNewConversation}
        className="underline transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        {strings.startNewChat}
      </button>{" "}
      {strings.forMorePassages}
    </p>
  </div>
)}
```

**5h — Update "Responding in" label** (around line 1245):
```tsx
<span className="text-[11px] text-zinc-400 dark:text-zinc-500">
  {strings.respondingIn}
</span>
```

**5i — Update SwipeAffordance labels** (around lines 1209-1220):
```tsx
{activeTab === "chat" && sourcesReady && (
  <SwipeAffordance
    direction="right"
    label={strings.viewPassages}
    onTap={() => handleTabChange("sources")}
  />
)}
{activeTab === "sources" && chatReady && (
  <SwipeAffordance
    direction="left"
    label={strings.backToAnswer}
    onTap={() => handleTabChange("chat")}
  />
)}
```

**5j — Update `MobileHeader` interface and usage** (around line 1390):

Add `strings` and `faqHref` to `MobileHeaderProps`:
```tsx
interface MobileHeaderProps {
  activeTab: "chat" | "sources";
  onTabChange: (tab: "chat" | "sources") => void;
  onMenuOpen: () => void;
  onNewChat: () => void;
  hasRag: boolean;
  chatReady: boolean;
  sourcesReady: boolean;
  strings: import("@/lib/i18n/chatStrings").ChatStrings;
  faqHref: string;
}
```

In the `MobileHeader` function body, destructure `strings` and `faqHref`, then update:
- `href="/faq"` → `href={faqHref}`
- `Popular Questions` → `{strings.popularQuestions}`
- `<span>Chat</span>` → `<span>{strings.chatTab}</span>`
- `<span>Passages</span>` → `<span>{strings.passagesTab}</span>`

And in ChatShell where `<MobileHeader>` is rendered, pass the new props:
```tsx
<MobileHeader
  activeTab={activeTab}
  onTabChange={handleTabChange}
  onMenuOpen={openMobileDrawer}
  onNewChat={handleNewConversation}
  hasRag={!!ragData}
  chatReady={chatReady}
  sourcesReady={sourcesReady}
  strings={strings}
  faqHref={faqHref}
/>
```

- [ ] **Step 6: Verify build and lint**

```bash
npm run build 2>&1 | tail -10
npm run lint 2>&1 | grep -E "error|Error" | head -10
```

Expected: clean build, no new errors (5 pre-existing lint warnings are normal).

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ChatPanel.tsx \
        src/components/chat/SourcesPanel.tsx \
        src/components/chat/Composer.tsx \
        src/components/chat/MessageList.tsx \
        src/components/chat/ChatShell.tsx
git commit -m "feat(i18n): localize chat UI strings for EN/ES/FR"
```

---

## Post-implementation checklist

- [ ] Run `npm run build` — clean
- [ ] Run `npm run lint` — no new errors vs baseline
- [ ] Visit `/faq` in browser — card grid loads, no accordion
- [ ] Visit `/es/faq` and `/fr/faq` — card grid, correct questions
- [ ] Click a card — navigates to `/q/[slug]` or `/es/q/[slug]`
- [ ] JSON-LD present on all three FAQ pages (view-source or DevTools)
- [ ] Switch chat language to Français — UI strings update (welcome card, passages panel, tabs, composer placeholder)
- [ ] Verify "Réponse:" / "Respuesta:" no longer appears in chat bubbles or SEO answer pages
- [ ] Verify "Evidencia:" / "Preuve:" styled as amber label chips in answers
- [ ] Deploy: `npm run deploy`