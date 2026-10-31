import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NatureSeries } from "@/components/seo/NatureSeries";
import { SECTION_LABELS, type FaqListItem, type FaqSection } from "@/lib/faq/groups";
import { seriesCopy, seriesOf, SERIES_PAGE_LANG_HREFS } from "@/lib/faq/series";

type Lang = "en" | "es" | "fr";

/**
 * The series' own page (`/faq/nature`, `/es/faq/nature`, `/fr/faq/nature`):
 * only Christianity Seen in Nature, open, so a shared link shows the whole
 * story in order. Same frame as the FAQ page, with a way back to it.
 */
export function NatureSeriesPage({ sections, lang }: { sections: FaqSection<FaqListItem>[]; lang: Lang }) {
  const c = seriesCopy(lang);
  const total = seriesOf(sections).length;
  const faqHref = lang === "en" ? "/faq" : `/${lang}/faq`;
  const slugPrefix = lang === "en" ? "/q" : `/${lang}/q`;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 xl:max-w-[56rem]">
          <BrandLogo href="/" priority />
          <div className="flex items-center gap-2">
            <LangSwitcher current={lang} hrefs={SERIES_PAGE_LANG_HREFS} />
            <Link
              href="/chat"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {c.askQuestion}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-10 xl:max-w-[56rem]">
          <Link href={faqHref} className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-foreground dark:text-zinc-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            {c.allQuestions}
          </Link>
          <h1 className="font-display mt-4 mb-2 text-3xl text-foreground lg:text-4xl">{SECTION_LABELS.nature[lang]}</h1>
          <p className="mb-7 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{c.pageIntro(sections.length, total)}</p>
          <NatureSeries sections={sections} lang={lang} slugPrefix={slugPrefix} standalone />
        </div>
        <SiteFooter language={lang} />
      </main>
    </div>
  );
}
