"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { groupName, SECTION_LABELS, type FaqListItem, type FaqSection } from "@/lib/faq/groups";
import { seriesCopy, seriesOf, seriesPagePath } from "@/lib/faq/series";
import { useSeriesRead } from "@/lib/faq/seriesProgress";

type Lang = "en" | "es" | "fr";

export const NATURE_SERIES_ANCHOR = "nature-series";

/**
 * Christianity Seen in Nature as one numbered path, read in order: parts
 * (its groups) along a single line, every question a numbered stop, those
 * this reader has opened filled in. Collapsed by default so the sections
 * below stay in view; opens on the toggle, or on arrival at #nature-series.
 * `standalone`: the series' own page (`/faq/nature`) — always open, the page
 * supplies the title and intro, and a share button replaces the toggle.
 */
export function NatureSeries({
  sections,
  lang,
  slugPrefix,
  standalone = false,
}: {
  sections: FaqSection<FaqListItem>[];
  lang: Lang;
  slugPrefix: string;
  standalone?: boolean;
}) {
  const c = seriesCopy(lang);
  const entries = seriesOf(sections);
  const read = useSeriesRead();
  const firstUnread = read ? entries.find((e) => !read.has(e.slug)) : undefined;
  const started = !!read && entries.some((e) => read.has(e.slug));
  const target = firstUnread ?? entries[0];
  const cta = !started ? c.start : firstUnread ? c.continueAt(firstUnread.number) : c.again;
  const [toggled, setOpen] = useState(false);
  const open = standalone || toggled;
  useEffect(() => {
    if (window.location.hash === `#${NATURE_SERIES_ANCHOR}`) setOpen(true);
  }, []);
  const pathId = `${NATURE_SERIES_ANCHOR}-path`;
  const PartHeading = standalone ? "h2" : "h3";
  let n = 0;

  return (
    <section id={NATURE_SERIES_ANCHOR} className="scroll-mt-6">
      {!standalone && (
        <>
          <h2 className="font-display text-[1.4rem] leading-tight text-foreground">{SECTION_LABELS.nature[lang]}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">{c.intro}</p>
        </>
      )}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${standalone ? "" : "mt-4"}`}>
        {target && (
          <Link
            href={`${slugPrefix}/${target.slug}`}
            className="inline-flex items-center rounded-full bg-[var(--series-accent)] px-4 py-2 text-sm font-medium text-[var(--series-on-accent)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-accent)]"
          >
            {cta}
          </Link>
        )}
        {standalone ? (
          <ShareSeriesButton lang={lang} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={pathId}
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-300"
            >
              {open ? c.hide : c.show(sections.length, entries.length)}
              <svg className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <Link href={seriesPagePath(lang)} className="text-sm text-[var(--series-accent)] hover:underline hover:underline-offset-4">
              {c.openPage}
            </Link>
          </>
        )}
      </div>

      {/* The path: one line, parts and numbered stops along it. Kept in the
          page (inert while closed) so the links stay crawlable. */}
      <div id={pathId} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <ol className="relative mt-6 ml-[15px] border-l border-[var(--series-line)] pb-1">
            {sections.map((s, i) => (
              <li key={s.group!.id} className={i > 0 ? "mt-7" : ""}>
                <div className="-ml-[5px] flex items-baseline gap-3">
                  <span aria-hidden="true" className="relative top-[-2px] h-[9px] w-[9px] shrink-0 rounded-full bg-[var(--series-accent)]" />
                  <PartHeading className="font-display text-[1.15rem] leading-tight text-foreground">
                    <span className="text-[var(--series-accent)]">{c.part(i + 1)}</span>
                    <span className="mx-2 text-zinc-300 dark:text-zinc-600" aria-hidden="true">/</span>
                    {groupName(s.group!, lang)}
                  </PartHeading>
                </div>
                <ol className="mt-2.5">
                  {s.items.map((item) => {
                    const num = ++n;
                    const done = !!read?.has(item.slug);
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`${slugPrefix}/${item.slug}`}
                          className="group -ml-[15px] flex items-start gap-3 rounded-lg py-2 pr-3 focus-visible:outline-2 focus-visible:outline-[var(--series-accent)]"
                        >
                          <span
                            className={`font-display flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border text-[15px] tabular-nums transition-colors ${
                              done
                                ? "border-[var(--series-accent)] bg-[var(--series-accent)] text-[var(--series-on-accent)]"
                                : "border-[var(--series-line)] bg-[var(--background)] text-zinc-600 group-hover:border-[var(--series-accent)] group-hover:text-[var(--series-accent)] dark:text-zinc-300"
                            }`}
                          >
                            {done ? (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            ) : (
                              num
                            )}
                            {done && <span className="sr-only">{`${num}, ${c.read}`}</span>}
                          </span>
                          <span className="pt-[5px] text-sm font-medium text-foreground group-hover:underline group-hover:decoration-[var(--series-accent)] group-hover:underline-offset-4 lg:text-[15px]">
                            {item.question}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Native share sheet where there is one, otherwise copy the series link. */
function ShareSeriesButton({ lang }: { lang: Lang }) {
  const c = seriesCopy(lang);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${seriesPagePath(lang)}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: SECTION_LABELS.nature[lang], text: c.intro, url });
      } catch {
        /* closed the sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button type="button" onClick={share} className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-300">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
      </svg>
      <span aria-live="polite">{copied ? c.copied : c.share}</span>
    </button>
  );
}
