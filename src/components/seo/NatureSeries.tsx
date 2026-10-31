"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { groupName, SECTION_LABELS, type FaqListItem, type FaqSection } from "@/lib/faq/groups";
import { seriesCopy, seriesOf } from "@/lib/faq/series";
import { useSeriesRead } from "@/lib/faq/seriesProgress";

type Lang = "en" | "es" | "fr";

export const NATURE_SERIES_ANCHOR = "nature-series";

/**
 * Christianity Seen in Nature as one numbered path, read in order: parts
 * (its groups) along a single line, every question a numbered stop, those
 * this reader has opened filled in. Collapsed by default so the sections
 * below stay in view; opens on the toggle, or on arrival at #nature-series
 * (the link from a question's series line).
 */
export function NatureSeries({ sections, lang, slugPrefix }: { sections: FaqSection<FaqListItem>[]; lang: Lang; slugPrefix: string }) {
  const c = seriesCopy(lang);
  const entries = seriesOf(sections);
  const read = useSeriesRead();
  const firstUnread = read ? entries.find((e) => !read.has(e.slug)) : undefined;
  const started = !!read && entries.some((e) => read.has(e.slug));
  const target = firstUnread ?? entries[0];
  const cta = !started ? c.start : firstUnread ? c.continueAt(firstUnread.number) : c.again;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === `#${NATURE_SERIES_ANCHOR}`) setOpen(true);
  }, []);
  const pathId = `${NATURE_SERIES_ANCHOR}-path`;
  let n = 0;

  return (
    <section id={NATURE_SERIES_ANCHOR} className="scroll-mt-6">
      <h2 className="font-display text-[1.4rem] leading-tight text-foreground">{SECTION_LABELS.nature[lang]}</h2>
      <p className="mt-1.5 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">{c.intro}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        {target && (
          <Link
            href={`${slugPrefix}/${target.slug}`}
            className="inline-flex items-center rounded-full bg-[var(--series-accent)] px-4 py-2 text-sm font-medium text-[var(--series-on-accent)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-accent)]"
          >
            {cta}
          </Link>
        )}
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
                  <h3 className="font-display text-[1.15rem] leading-tight text-foreground">
                    <span className="text-[var(--series-accent)]">{c.part(i + 1)}</span>
                    <span className="mx-2 text-zinc-300 dark:text-zinc-600" aria-hidden="true">/</span>
                    {groupName(s.group!, lang)}
                  </h3>
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
