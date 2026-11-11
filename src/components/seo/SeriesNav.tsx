"use client";

import { useEffect } from "react";
import Link from "next/link";
import { seriesCopy, seriesPagePath, type SeriesPosition } from "@/lib/faq/series";
import { markSeriesRead, useSeriesRead } from "@/lib/faq/seriesProgress";
import { WHATSAPP_CHANNEL_URL } from "@/lib/site/social";
import { WhatsAppIcon } from "@/components/site/SocialIcons";

const qHref = (slug: string, language: string) => (language === "en" ? `/q/${slug}` : `/${language}/q/${slug}`);

/**
 * Above a nature question: where it sits in the series (links to the
 * series page), and — for a reader who arrives mid-series without
 * having read the question before it — a pointer back to question 1.
 * Opening the page marks the question read.
 */
export function SeriesHeader({ slug, series, language }: { slug: string; series: SeriesPosition; language: string }) {
  const c = seriesCopy(language);
  const read = useSeriesRead();
  useEffect(() => markSeriesRead(slug), [slug]);
  // Unknown until hydrated (read === null): say nothing rather than flash it.
  const arrivedMidway = !!read && series.number > 1 && !!series.prev && !read.has(series.prev.slug);
  return (
    <div className="mb-3">
      <Link href={seriesPagePath(language)} className="text-[13px] font-medium text-[var(--series-accent)] hover:underline hover:underline-offset-4">
        {c.position(series.part, series.number, series.total)}
        <span className="text-zinc-500 dark:text-zinc-400">{`: ${series.partName}`}</span>
      </Link>
      {arrivedMidway && (
        <p className="mt-2 text-[13px] text-zinc-600 dark:text-zinc-300">
          {c.buildsOn}{" "}
          <Link href={qHref(series.first.slug, language)} className="font-medium text-[var(--series-accent)] underline underline-offset-4">
            {c.startAtOne}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Below a nature answer: previous / next in the series, in place of the generic Next link. */
export function SeriesNav({ series, language }: { series: SeriesPosition; language: string }) {
  const c = seriesCopy(language);
  return (
    <nav aria-label={c.position(series.part, series.number, series.total)} className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      {series.next ? (
        <Link
          href={qHref(series.next.slug, language)}
          className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--series-line)] px-4 py-3 transition-colors hover:border-[var(--series-accent)]"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-[var(--series-accent)]">{c.next}</span>
            <span className="font-display mt-0.5 block text-[1.05rem] leading-snug text-foreground">{series.next.question}</span>
          </span>
          <svg className="h-5 w-5 shrink-0 text-[var(--series-accent)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{c.end}</p>
          <SeriesChannelCta language={language} className="mt-4" />
        </>
      )}
      {series.prev && (
        <Link href={qHref(series.prev.slug, language)} className="mt-3 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-foreground dark:text-zinc-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          {`${c.previous}: ${series.prev.question}`}
        </Link>
      )}
    </nav>
  );
}

/** End of the series: the WhatsApp channel, where readers can stay and reach us. */
export function SeriesChannelCta({ language, className = "" }: { language: string; className?: string }) {
  const c = seriesCopy(language);
  return (
    <section className={`flex flex-col gap-2.5 rounded-2xl border border-[var(--series-line)] p-5 ${className}`}>
      <h2 className="font-display text-[1.3rem] leading-tight text-foreground">{c.channelTitle}</h2>
      <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">{c.channelBody}</p>
      <a
        href={WHATSAPP_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--series-accent)] px-4 py-2 text-sm font-medium text-[var(--series-on-accent)] transition-opacity hover:opacity-90"
      >
        <WhatsAppIcon />
        {c.channelButton}
      </a>
    </section>
  );
}
