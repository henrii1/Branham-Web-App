import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BibleQuestionsList, type BibleTopic } from "./BibleQuestionsList";
import { BIBLE_PAGE_COPY } from "@/lib/faq/bibleQuestions";
import { bibleQuestionsHref, chatHref } from "@/lib/site/home";

type Lang = "en" | "es" | "fr";
const LANG_HREFS = { en: bibleQuestionsHref("en"), fr: bibleQuestionsHref("fr"), es: bibleQuestionsHref("es") };

/**
 * Every Bible question on one page (/faq/bible, + /fr, /es), grouped by
 * topic and searchable: the fast way in, since a ready answer opens
 * instantly. Ends with "Ask the Bible" for anything not answered yet.
 */
export function BibleQuestionsPage({ lang, topics, natureCount }: { lang: Lang; topics: BibleTopic[]; natureCount: number }) {
  const c = BIBLE_PAGE_COPY[lang];
  const total = topics.reduce((n, t) => n + t.items.length, 0);
  return (
    <div lang={lang} className="min-h-dvh bg-[var(--home-day)] text-foreground">
      <SiteHeader lang={lang} langHrefs={LANG_HREFS} tone="night" natureCount={natureCount} bibleCount={total} />
      <section className="bg-[linear-gradient(180deg,var(--home-night),#1d4632_70%,#2c5a40)] pt-12 pb-16 text-[#edf0e8] md:pt-16">
        <div className="mx-auto max-w-[60rem] px-4 sm:px-6">
          <h1 className="font-display text-[clamp(2.4rem,5vw,3.4rem)] leading-[1.02] font-normal tracking-[-0.02em]">{c.title}</h1>
          <p className="mt-3.5 max-w-[36rem] text-[17px] leading-relaxed text-[#edf0e8]/80">{c.intro}</p>
          <p className="mt-3 text-[13.5px] text-[#edf0e8]/60">{c.meta(total, topics.length)}</p>
        </div>
      </section>
      <main className="mx-auto max-w-[60rem] px-4 pb-20 sm:px-6">
        <BibleQuestionsList topics={topics} slugPrefix={lang === "en" ? "/q" : `/${lang}/q`} lang={lang} />
        <div className="mt-14 flex flex-wrap items-center justify-between gap-5 rounded-[18px] border border-[var(--home-line)] bg-[var(--home-card)] p-6">
          <div>
            <h2 className="font-display text-[1.4rem] leading-tight font-medium">{c.askTitle}</h2>
            <p className="mt-1 text-[14.5px] text-zinc-500 dark:text-zinc-400">{c.askBody}</p>
          </div>
          <Link prefetch={false} href={chatHref("bible")} className="flex h-12 items-center rounded-full bg-[var(--home-meadow)] px-6 text-[15px] font-medium text-white hover:bg-[#265a39]">
            {c.askButton}
          </Link>
        </div>
      </main>
      <SiteFooter language={lang} />
    </div>
  );
}
