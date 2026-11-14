import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SeriesChannelCta } from "./SeriesNav";
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
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader lang={lang} langHrefs={SERIES_PAGE_LANG_HREFS} tone="night" natureCount={total} />

      <main className="flex-1">
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
          <SeriesChannelCta language={lang} className="mt-10" />
        </div>
        <SiteFooter language={lang} />
      </main>
    </div>
  );
}
