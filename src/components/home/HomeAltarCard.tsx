"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadToday, type TodayRow } from "@/components/altar/TodayAltarCard";
import { localTodayIso } from "@/lib/altar/week";
import { altarHref } from "@/lib/altar/strings";
import { ALTAR_GENERATED_LANGUAGES, type AltarLanguage } from "@/lib/altar/types";

type State = { status: "loading" } | { status: "ready"; row: TodayRow } | { status: "none" };

/** Today's Family Altar verse on the home page (the reader's local date). */
export function HomeAltarCard({ lang, copy }: { lang: AltarLanguage; copy: { label: string; open: string; preparing: string } }) {
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
      prefetch={false}
      href={altarHref(lang)}
      aria-busy={state.status === "loading"}
      className="group block rounded-[22px] bg-gradient-to-br from-[#fbf1dc] to-[#f4dfb5] p-7 text-[#3d2c10] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 dark:from-[#3a2f1c] dark:to-[#2c2416] dark:text-[#f3e3c3]"
    >
      <span className="text-[13.5px] font-medium text-[#8a5a12] dark:text-amber-300">{copy.label}</span>
      {state.status === "loading" && (
        <span className="mt-4 flex flex-col gap-2" aria-hidden="true">
          <span className="h-6 w-11/12 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <span className="h-6 w-8/12 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </span>
      )}
      {state.status === "ready" && (
        <>
          <blockquote className="font-display mt-3 line-clamp-5 text-[1.4rem] leading-[1.3] text-pretty">“{state.row.scripture_text}”</blockquote>
          <span className="mt-2.5 block text-[13.5px] text-[#7a5a2a] dark:text-amber-200/80">{state.row.scripture_ref} ({state.row.bible_version})</span>
        </>
      )}
      {state.status === "none" && <p className="mt-3 text-[15px]">{copy.preparing}</p>}
      <span className="mt-5 inline-flex border-b border-[#c69a4f] pb-0.5 text-[15px] font-medium group-hover:border-current">{copy.open}</span>
    </Link>
  );
}
