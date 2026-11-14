"use client";

import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown/render";
import { applyNgramHighlights } from "@/lib/markdown/ngramHighlight";
import { bestExcerpt, markTerms, parseRagSermons, queryTerms, type RagSermon } from "@/lib/markdown/ragCards";

export interface PassageCardsCopy {
  sermonsFound: (n: number) => string;
  readPassages: (n: number) => string;
  showLess: string;
}

export const PASSAGE_CARDS_COPY: Record<"en" | "es" | "fr", PassageCardsCopy> = {
  en: {
    sermonsFound: (n) => (n === 1 ? "1 sermon" : `${n} sermons`),
    readPassages: (n) => (n === 1 ? "Read the passage" : `Read the ${n} passages`),
    showLess: "Show less",
  },
  es: {
    sermonsFound: (n) => (n === 1 ? "1 sermón" : `${n} sermones`),
    readPassages: (n) => (n === 1 ? "Leer el pasaje" : `Leer los ${n} pasajes`),
    showLess: "Mostrar menos",
  },
  fr: {
    sermonsFound: (n) => (n === 1 ? "1 sermon" : `${n} sermons`),
    readPassages: (n) => (n === 1 ? "Lire le passage" : `Lire les ${n} passages`),
    showLess: "Afficher moins",
  },
};

export function passageCardsCopy(language: string): PassageCardsCopy {
  return PASSAGE_CARDS_COPY[language === "es" || language === "fr" ? language : "en"];
}

/**
 * The retrieved passages as one card per sermon: title, date id and
 * paragraphs, then the few sentences that best match the question (matching
 * words marked). "Read the passages" opens everything retrieved from that
 * sermon, with the usual phrase highlighting. Falls back to the plain
 * markdown when the context isn't in the expected shape.
 */
export function PassageCards({ context, query, copy }: { context: string; query: string; copy: PassageCardsCopy }) {
  const sermons = useMemo(() => parseRagSermons(context), [context]);
  const terms = useMemo(() => queryTerms(query), [query]);

  if (!sermons.length) {
    return (
      <div
        className="sources-markdown prose prose-sm prose-zinc max-w-none px-5 py-4 dark:prose-invert"
        data-nosnippet
        dangerouslySetInnerHTML={{ __html: applyNgramHighlights(renderMarkdown(context), query) }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4" data-nosnippet>
      <p className="px-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">{copy.sermonsFound(sermons.length)}</p>
      {sermons.map((s, i) => (
        <SermonCard key={`${s.dateId}-${i}`} sermon={s} terms={terms} copy={copy} />
      ))}
    </div>
  );
}

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {markTerms(text, terms).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-[#fff1c7] px-0.5 text-inherit dark:bg-[rgba(250,204,21,0.22)]">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function SermonCard({ sermon, terms, copy }: { sermon: RagSermon; terms: string[]; copy: PassageCardsCopy }) {
  const [open, setOpen] = useState(false);
  const excerpt = useMemo(() => bestExcerpt(sermon, terms), [sermon, terms]);

  return (
    <article className="rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-3.5 shadow-[0_1px_0_rgba(11,29,22,.03)] dark:border-zinc-700/80">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-[12.5px] leading-snug font-semibold tracking-[0.01em] text-[var(--home-meadow)] dark:text-[var(--home-leaf)]">{sermon.title}</h3>
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
          {sermon.dateId} · {excerpt.refs}
        </span>
      </header>
      {!open && (
        <p className="font-display mt-2 text-[15.5px] leading-[1.55] text-zinc-800 dark:text-zinc-200">
          {excerpt.trimmedStart && "…"}
          {excerpt.parts.map((p, i) =>
            p.hit ? (
              <mark key={i} className="rounded-[3px] bg-[#fff1c7] px-0.5 text-inherit dark:bg-[rgba(250,204,21,0.22)]">
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
          {excerpt.trimmedEnd && "…"}
        </p>
      )}
      {open && (
        <div className="mt-2.5 flex flex-col gap-4">
          {sermon.chunks.map((c, ci) => (
            <section key={ci}>
              <h4 className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{c.refs}</h4>
              {c.text.split(/\n+/).filter((t) => t.trim()).map((para, pi) => (
                <p key={pi} className="font-display mt-1.5 text-[15.5px] leading-[1.6] text-zinc-800 dark:text-zinc-200">
                  <Marked text={para} terms={terms} />
                </p>
              ))}
            </section>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--home-meadow)] hover:underline hover:underline-offset-4 dark:text-[var(--home-leaf)]"
      >
        {open ? copy.showLess : copy.readPassages(sermon.chunks.length)}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </article>
  );
}
