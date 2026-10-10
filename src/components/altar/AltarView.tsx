"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthGate";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { ReferencePopover } from "@/components/chat/ReferencePopover";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { renderMarkdown } from "@/lib/markdown/render";
import { applyCitations } from "@/lib/markdown/citations";
import { ALTAR_STRINGS, altarHref, type AltarStrings } from "@/lib/altar/strings";
import { localTodayIso, mondayOf, weekDays } from "@/lib/altar/week";
import type { AltarLanguage, FamilyAltarDay } from "@/lib/altar/types";

const AltarAdmin = dynamic(() => import("./AltarAdmin").then((m) => ({ default: m.AltarAdmin })), { ssr: false });

// The reader's local calendar date. Server render has no local date, so it
// renders a neutral state and the browser fills in "today" on hydration.
const subscribeNoop = () => () => {};
const useLocalToday = () => useSyncExternalStore(subscribeNoop, () => localTodayIso(), () => null);

function FlameIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1.2-.5-2-1-2.8 2.3 1 4 3.3 4 6.3a5.5 5.5 0 0 1-11 0C6.5 9.5 10 7.5 12 3Z" />
      <path d="M5 21h14" />
    </svg>
  );
}

const fmt = (iso: string, locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AltarView({
  language,
  rows,
  englishRows,
}: {
  language: AltarLanguage;
  /** Ready rows in this page's language (current + next week). */
  rows: FamilyAltarDay[];
  /** English rows, for the "read in English" fallback on es/fr pages. */
  englishRows: FamilyAltarDay[];
}) {
  const s = ALTAR_STRINGS[language];
  const { user } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  const today = useLocalToday();
  const [picked, setPicked] = useState<string | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);

  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const enByDay = useMemo(() => new Map(englishRows.map((r) => [r.day, r])), [englishRows]);

  if (!today) {
    return <div className="flex h-dvh items-center justify-center bg-background" aria-busy="true" />;
  }

  const week = weekDays(mondayOf(today));
  const selected = picked && week.includes(picked) ? picked : today;
  const idx = week.indexOf(selected);
  const row = byDay.get(selected) ?? null;
  const fallback = !row && language !== "en" ? (enByDay.get(selected) ?? null) : null;
  const shown = row ?? (showEnglish ? fallback : null);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-[var(--surface-base)] px-4 py-2.5 dark:border-zinc-800">
        <Link prefetch={false} href="/chat" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          {s.backToChat}
        </Link>
        <div className="font-display flex items-center gap-2 text-lg text-foreground">
          <FlameIcon className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          {s.pageTitle}
        </div>
        <LangSwitcher current={language} hrefs={{ en: altarHref("en"), es: altarHref("es"), fr: altarHref("fr") }} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Week: strip on phones, list on desktop */}
        <nav aria-label={s.thisWeek} className="shrink-0 border-b border-zinc-200 bg-[var(--surface-base)] px-3 py-2.5 lg:w-64 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:bg-[var(--surface-sidebar)] lg:px-3 lg:py-5 dark:border-zinc-800">
          <div className="mb-2 flex items-baseline justify-between px-1 lg:mb-3 lg:flex-col lg:gap-0.5 lg:px-2">
            <h2 className="text-xs font-medium text-zinc-500 lg:text-sm lg:text-foreground dark:text-zinc-400">{s.thisWeek}</h2>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {cap(fmt(week[0], s.locale, { month: "short", day: "numeric" }))} – {fmt(week[6], s.locale, { month: "short", day: "numeric" })}
            </span>
          </div>
          <ol className="grid grid-cols-7 gap-1 lg:grid-cols-1 lg:gap-0.5">
            {week.map((d) => {
              const r = byDay.get(d) ?? (language !== "en" ? enByDay.get(d) : undefined);
              const isToday = d === today;
              const isSel = d === selected;
              return (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setPicked(d)}
                    aria-current={isSel ? "date" : undefined}
                    aria-label={`${cap(fmt(d, s.locale, { weekday: "long", month: "long", day: "numeric" }))}${isToday ? `, ${s.today}` : ""}`}
                    className={`flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors lg:grid lg:grid-cols-[1fr_auto] lg:items-baseline lg:gap-x-2 lg:px-2.5 lg:py-2 lg:text-left ${
                      isSel ? "lg:bg-[var(--surface-base)] lg:shadow-sm lg:ring-1 lg:ring-zinc-200 dark:lg:ring-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-[11px] text-zinc-500 lg:text-sm lg:font-medium lg:text-foreground dark:text-zinc-400">
                      {cap(fmt(d, s.locale, { weekday: "short" }))}
                      {isToday && <span className="ml-1.5 hidden text-xs font-medium text-amber-700 lg:inline dark:text-amber-400">{s.today}</span>}
                    </span>
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium tabular-nums lg:h-auto lg:w-auto lg:text-xs lg:font-normal ${
                        isSel
                          ? isToday ? "bg-amber-700 text-white lg:bg-transparent lg:text-zinc-500 dark:bg-amber-400 dark:text-zinc-900" : "bg-zinc-900 text-white lg:bg-transparent lg:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900"
                          : isToday ? "text-amber-700 dark:text-amber-400 lg:text-zinc-500" : "text-foreground lg:text-zinc-500"
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    <span className="hidden truncate text-xs text-zinc-500 lg:col-span-2 lg:block dark:text-zinc-400">{r?.scripture_ref ?? "—"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[42rem] flex-col gap-7 px-5 py-7 lg:px-10 lg:py-12">
            <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              {selected === today && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">{s.today}</span>
              )}
              {cap(fmt(selected, s.locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}
            </p>

            {isAdmin && <AltarAdmin day={selected} week={week} row={row} today={today} />}

            {shown ? (
              <>
                {fallback && showEnglish && (
                  <p className="text-xs text-zinc-500">
                    {s.shownInEnglish}{" "}
                    <button type="button" className="underline" onClick={() => setShowEnglish(false)}>{s.hide}</button>
                  </p>
                )}
                <Devotional row={shown} s={ALTAR_STRINGS[shown.language]} />
              </>
            ) : fallback ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-amber-300 p-5 dark:border-amber-800/60">
                <h1 className="font-display text-xl text-foreground">{s.unavailableTitle}</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{s.unavailableBody}</p>
                <button type="button" onClick={() => setShowEnglish(true)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium dark:border-zinc-700">
                  {s.readInEnglish}
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {rows.length === 0 && englishRows.length === 0 ? s.emptyWeek : s.notReady}
              </p>
            )}

            <nav className="grid grid-cols-2 gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800" aria-label={s.thisWeek}>
              {[idx - 1, idx + 1].map((i, k) =>
                i >= 0 && i < 7 ? (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPicked(week[i])}
                    className={`flex min-w-0 flex-col gap-0.5 rounded-xl border border-zinc-200 px-3 py-2.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${k === 1 ? "items-end text-right" : "items-start text-left"}`}
                  >
                    <span className="text-[11px] text-zinc-500">{k === 0 ? s.previousDay : s.nextDay}</span>
                    <span className="max-w-full truncate text-sm font-medium text-foreground">
                      {cap(fmt(week[i], s.locale, { weekday: "long" }))}
                    </span>
                  </button>
                ) : (
                  <span key={k} />
                ),
              )}
            </nav>
          </div>
        </main>
      </div>
      <ReferencePopover />
    </div>
  );
}

function Devotional({ row, s }: { row: FamilyAltarDay; s: AltarStrings }) {
  const [copied, setCopied] = useState(false);
  const html = (md: string | null) => (md ? applyCitations(renderMarkdown(md)) : "");
  const refsHtml = row.sermon_references.length
    ? applyCitations(renderMarkdown(row.sermon_references.map((r) => `- [${r}]`).join("\n")))
    : "";
  const prose = "chat-markdown prose prose-zinc max-w-none break-words dark:prose-invert prose-p:leading-relaxed";

  async function copyPrayer() {
    const text = [row.prayer_intro, ...row.prayer_points.map((p) => `• ${p}`)].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard refused; nothing to undo */
    }
  }

  return (
    <article data-message-lang={row.language} className="flex flex-col gap-7">
      <figure className="m-0 flex flex-col gap-3">
        <blockquote className="font-display m-0 text-2xl leading-snug text-pretty text-foreground lg:text-[1.9rem]">{row.scripture_text}</blockquote>
        <figcaption className="text-sm text-zinc-600 dark:text-zinc-300">
          <span className="font-semibold text-foreground">{row.scripture_ref}</span> <span className="text-zinc-500">({row.bible_version})</span>
        </figcaption>
      </figure>
      <hr className="border-zinc-200 dark:border-zinc-800" />
      <h1 className="font-display text-3xl leading-tight text-balance text-foreground">{row.title}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-foreground">{s.reflection}</h2>
        <div className={prose} dangerouslySetInnerHTML={{ __html: html(row.reflection_markdown) }} />
      </section>

      {row.sermon_quotes_markdown && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-foreground">{s.fromSermons}</h2>
          <div className={`${prose} prose-blockquote:font-display prose-blockquote:not-italic prose-blockquote:border-l-amber-300 dark:prose-blockquote:border-l-amber-800`} dangerouslySetInnerHTML={{ __html: html(row.sermon_quotes_markdown) }} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-foreground">{s.talkTogether}</h2>
        <ol className="flex list-none flex-col gap-2.5 p-0">
          {row.discussion_questions.map((q, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2 text-[15.5px] text-foreground">
              <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full border border-zinc-300 text-xs text-zinc-500 tabular-nums dark:border-zinc-600">{i + 1}</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-800/50 dark:bg-amber-900/10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display flex items-center gap-2 text-xl text-foreground">
            <FlameIcon className="h-4.5 w-4.5 text-amber-700 dark:text-amber-400" />
            {s.prayerPoints}
          </h2>
          <button type="button" onClick={copyPrayer} className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-amber-100 dark:text-zinc-300 dark:hover:bg-amber-900/30">
            {copied ? s.copied : s.copyPrayer}
          </button>
        </div>
        {row.prayer_intro && <p className="text-[15.5px] text-foreground">{row.prayer_intro}</p>}
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15.5px] text-foreground">
          {row.prayer_points.map((p, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: applyCitations(renderMarkdown(p)).replace(/^<p>|<\/p>\s*$/g, "") }} />
          ))}
        </ul>
      </section>

      {refsHtml && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl text-foreground">{s.references}</h2>
          <div className={prose} dangerouslySetInnerHTML={{ __html: refsHtml }} />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {s.readerNote}{" "}
            <a href="https://table.branham.org/" target="_blank" rel="noopener noreferrer" className="underline">The Table</a>.
          </p>
        </section>
      )}
    </article>
  );
}
