"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BIBLE_PAGE_COPY } from "@/lib/faq/bibleQuestions";

export interface BibleTopic {
  id: string;
  name: string;
  items: { slug: string; question: string }[];
}


const SHOWN = 3;

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The Bible questions, grouped by topic: a search that filters as you type,
 * topic chips that jump to a topic, and three questions per topic until
 * "N more" opens the rest.
 */
export function BibleQuestionsList({ topics, slugPrefix, lang }: { topics: BibleTopic[]; slugPrefix: string; lang: "en" | "es" | "fr" }) {
  const copy = BIBLE_PAGE_COPY[lang];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const q = fold(query.trim());

  const shown = useMemo(() => {
    if (!q) return topics;
    const words = q.split(/\s+/);
    return topics
      .map((t) => {
        const topicHit = words.every((w) => fold(t.name).includes(w));
        return { ...t, items: topicHit ? t.items : t.items.filter((i) => words.every((w) => fold(i.question).includes(w))) };
      })
      .filter((t) => t.items.length);
  }, [q, topics]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="relative -mt-7 max-w-[35rem]">
        <svg className="pointer-events-none absolute top-1/2 left-4 h-[19px] w-[19px] -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <circle cx="11" cy="11" r="6" />
          <path strokeLinecap="round" d="m15.5 15.5 4 4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="h-[54px] w-full rounded-2xl border border-[var(--home-line)] bg-[var(--home-card)] pr-4 pl-12 text-[16px] text-foreground shadow-[0_10px_30px_-18px_rgba(0,0,0,.45)] outline-none placeholder:text-zinc-400 focus:border-[var(--home-meadow)] dark:focus:border-[var(--home-leaf)]"
        />
      </div>

      {!q && (
        <nav aria-label={copy.all} className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {topics.map((t) => (
            <a key={t.id} href={`#topic-${t.id}`} className="shrink-0 rounded-full border border-[var(--home-line)] bg-[var(--home-card)] px-3.5 py-1.5 text-[13.5px] text-foreground hover:border-[var(--home-meadow)]">
              {t.name}
            </a>
          ))}
        </nav>
      )}

      {q && !shown.length && <p className="mt-10 text-[16px] text-zinc-500 dark:text-zinc-400">{copy.noMatch(query.trim())}</p>}

      {shown.map((t) => {
        const expanded = !!q || open.has(t.id);
        const items = expanded ? t.items : t.items.slice(0, SHOWN);
        const hidden = t.items.length - SHOWN;
        return (
          <section key={t.id} id={`topic-${t.id}`} className="mt-10 scroll-mt-6">
            <h2 className="font-display text-[1.6rem] leading-tight font-medium">
              {t.name}
              <span className="ml-2.5 align-middle font-sans text-[13.5px] font-normal text-zinc-500 dark:text-zinc-400">{copy.count(t.items.length)}</span>
            </h2>
            <ul className="mt-3 border-t border-[var(--home-line)]">
              {items.map((i) => (
                <li key={i.slug} className="border-b border-[var(--home-line)]">
                  <Link prefetch={false} href={`${slugPrefix}/${i.slug}`} className="group flex items-center justify-between gap-4 py-3.5 text-[16.5px] hover:text-[var(--home-meadow)] dark:hover:text-[var(--home-leaf)]">
                    {i.question}
                    <svg className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-current" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
            {!q && hidden > 0 && (
              <button type="button" onClick={() => toggle(t.id)} aria-expanded={expanded} className="mt-3 text-[14px] font-medium text-[var(--home-meadow)] hover:underline hover:underline-offset-4 dark:text-[var(--home-leaf)]">
                {expanded ? copy.less : copy.more(hidden)}
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}
