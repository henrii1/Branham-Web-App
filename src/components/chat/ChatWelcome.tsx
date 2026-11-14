"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChatStrings } from "@/lib/i18n/chatStrings";
import { searchAnswered, type BibleQuestionSet } from "@/lib/faq/useBibleQuestions";
import { bibleQuestionsHref } from "@/lib/site/home";

const qHref = (lang: string, slug: string) => (lang === "es" || lang === "fr" ? `/${lang}/q/${slug}` : `/q/${slug}`);

/**
 * A new chat in Bible search: the questions already answered come first
 * (they open instantly; a new answer takes 30–45 seconds), with a search
 * over all of them; the chat box below is the second way in.
 */
export function BibleWelcome({ strings, lang, questions }: { strings: ChatStrings; lang: string; questions: BibleQuestionSet | null }) {
  const [query, setQuery] = useState("");
  const results = questions && query.trim() ? searchAnswered(questions.all, query) : null;
  const list = results ?? questions?.featured ?? [];
  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-8 pb-6 sm:pt-12">
      <h1 className="font-display text-center text-[2rem] leading-tight font-normal tracking-[-0.015em] text-foreground sm:text-[2.5rem]">{strings.bibleTitle}</h1>
      <p className="mt-2 max-w-[34rem] text-center text-[15px] leading-normal text-zinc-500 dark:text-zinc-400">{strings.bibleLede}</p>
      <div className="mt-8 w-full max-w-[45rem]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-semibold text-foreground">
            {strings.answeredHeading} <span className="font-normal text-zinc-500 dark:text-zinc-400">· {strings.answeredInstant}</span>
          </h2>
          {questions && questions.all.length > 0 && (
            <Link prefetch={false} href={bibleQuestionsHref(lang)} className="border-b border-[#a9c8b2] text-[14px] font-medium text-[var(--home-meadow)] dark:border-[#4c6b56] dark:text-[var(--home-leaf)]">
              {strings.allBibleQuestions(questions.all.length)}
            </Link>
          )}
        </div>
        <div className="relative mt-3">
          <svg className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path strokeLinecap="round" d="m15.5 15.5 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.findQuestion}
            aria-label={strings.findQuestion}
            className="h-12 w-full rounded-xl border border-zinc-200 bg-[var(--surface-base)] pr-3 pl-11 text-[15.5px] text-foreground outline-none placeholder:text-zinc-400 focus:border-[var(--home-meadow)] dark:border-zinc-700 dark:focus:border-[var(--home-leaf)]"
          />
        </div>
        {results && results.length === 0 ? (
          <p className="mt-4 text-[14.5px] text-zinc-500 dark:text-zinc-400">{strings.noAnsweredMatch}</p>
        ) : (
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" aria-busy={!questions}>
            {!questions &&
              [0, 1, 2, 3].map((i) => <li key={i} className="h-[74px] animate-pulse rounded-xl bg-zinc-200/70 dark:bg-zinc-800" />)}
            {list.map((q) => (
              <li key={q.slug}>
                <Link
                  prefetch={false}
                  href={qHref(lang, q.slug)}
                  className="flex h-full flex-col gap-1.5 rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-3 text-[15px] leading-snug text-foreground transition-colors hover:border-[var(--home-meadow)] dark:border-zinc-700 dark:hover:border-[var(--home-leaf)]"
                >
                  {q.question}
                  <small className="text-[12.5px] text-[var(--home-meadow)] dark:text-[var(--home-leaf)]">{q.group}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * A new chat in sermon search: what it is, what a citation looks like,
 * three questions to try (sent on tap), and the Bible questions one tap away.
 */
export function SermonWelcome({ strings, lang, bibleCount, onAsk }: { strings: ChatStrings; lang: string; bibleCount: number | null; onAsk: (q: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-8 pb-6 sm:pt-12">
      <h1 className="font-display text-center text-[2rem] leading-tight font-normal tracking-[-0.015em] text-foreground sm:text-[2.5rem]">{strings.sermonsTitle}</h1>
      <p className="mt-2 max-w-[32rem] text-center text-[15px] leading-normal text-zinc-500 dark:text-zinc-400">{strings.sermonsLede}</p>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
        {strings.citationExample}
        <span className="citation-pill">THE REVELATION OF JESUS CHRIST — 60-1204M: ¶200</span>
      </p>
      <div className="mt-7 w-full max-w-[36rem]">
        <h2 className="text-[14px] font-semibold text-foreground">{strings.tryAsking}</h2>
        <ul className="mt-2.5 flex flex-col gap-2">
          {strings.sermonExamples.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onAsk(q)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:border-[var(--home-meadow)] dark:border-zinc-700 dark:hover:border-[var(--home-leaf)]"
              >
                {q}
                <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 10 4 15l5 5M4 15h11a5 5 0 0 0 5-5V4" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-[14px] bg-[var(--home-chip)] px-4 py-3.5 text-[14px] leading-normal text-zinc-700 dark:text-zinc-200">
          <b className="font-semibold text-foreground">{strings.bibleStripTitle}</b> {bibleCount ? strings.bibleStripBody(bibleCount) : ""}{" "}
          <Link prefetch={false} href={bibleQuestionsHref(lang)} className="border-b border-[#a9c8b2] font-medium text-[var(--home-meadow)] dark:border-[#4c6b56] dark:text-[var(--home-leaf)]">
            {strings.browseBible}
          </Link>
        </div>
      </div>
    </div>
  );
}
