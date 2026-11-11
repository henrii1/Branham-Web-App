"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadToday, type TodayRow } from "@/components/altar/TodayAltarCard";
import { localTodayIso } from "@/lib/altar/week";
import { altarHref } from "@/lib/altar/strings";
import { ALTAR_GENERATED_LANGUAGES, type AltarLanguage } from "@/lib/altar/types";

type State = { status: "loading" } | { status: "ready"; row: TodayRow } | { status: "none" };

/** Today's Family Altar verse (the reader's local date), linking to the devotion. */
export function TodayVerse({ lang, copy }: { lang: AltarLanguage; copy: { label: string; open: string; preparing: string } }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const contentLang = ALTAR_GENERATED_LANGUAGES.includes(lang) ? lang : "en";
    loadToday(localTodayIso(), contentLang).then((row) => {
      if (!cancelled) setState(row ? { status: "ready", row } : { status: "none" });
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <Link
      href={altarHref(lang)}
      aria-busy={state.status === "loading"}
      className="group mt-7 flex flex-col gap-2.5 border-l-2 border-amber-400 py-1 pl-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500 dark:border-amber-600"
    >
      <span className="text-[13px] font-medium text-amber-800 dark:text-amber-400">{copy.label}</span>
      {state.status === "loading" && (
        <span className="flex flex-col gap-2" aria-hidden="true">
          <span className="h-6 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-6 w-9/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-4 w-5/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </span>
      )}
      {state.status === "ready" && (
        <>
          <blockquote className="font-display m-0 line-clamp-5 text-[1.45rem] leading-[1.3] text-pretty text-foreground">“{state.row.scripture_text}”</blockquote>
          <span className="text-[13.5px] text-zinc-500 dark:text-zinc-400">{state.row.scripture_ref} (KJV)</span>
        </>
      )}
      {state.status === "none" && <span className="text-[15px] text-foreground">{copy.preparing}</span>}
      <span className="flex items-center gap-1 text-sm font-medium text-amber-800 group-hover:underline group-hover:underline-offset-4 dark:text-amber-300">
        {copy.open}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
