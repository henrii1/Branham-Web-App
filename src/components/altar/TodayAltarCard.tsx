"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { localTodayIso } from "@/lib/altar/week";
import { ALTAR_STRINGS, altarHref } from "@/lib/altar/strings";
import { ALTAR_GENERATED_LANGUAGES, type AltarLanguage } from "@/lib/altar/types";

interface TodayRow {
  scripture_ref: string;
  scripture_text: string;
  title: string | null;
  discussion_questions: string[];
  prayer_points: string[];
}

type CardState = { status: "loading" } | { status: "ready"; row: TodayRow } | { status: "none" };

// One request per day, shared by both ChatPanel instances (desktop + mobile).
const cache = new Map<string, Promise<TodayRow | null>>();
function loadToday(day: string, language: AltarLanguage): Promise<TodayRow | null> {
  const key = `${day}:${language}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      Promise.resolve(
        createClient()
          .from("family_altar_days")
          .select("scripture_ref, scripture_text, title, discussion_questions, prayer_points")
          .eq("day", day)
          .eq("language", language)
          .eq("status", "ready")
          .maybeSingle(),
      ).then(({ data }) => (data as TodayRow | null) ?? null, () => null),
    );
  }
  return cache.get(key)!;
}

const COPY = {
  en: { questions: (n: number) => `${n} question${n === 1 ? "" : "s"} to talk about`, prayer: (n: number) => `${n} prayer point${n === 1 ? "" : "s"}`, open: "Open today's devotion", preparing: "Today's devotion is being prepared.", openWeek: "Open this week's Family Altar" },
  es: { questions: (n: number) => `${n} pregunta${n === 1 ? "" : "s"} para conversar`, prayer: (n: number) => `${n} punto${n === 1 ? "" : "s"} de oración`, open: "Abrir el devocional de hoy", preparing: "El devocional de hoy se está preparando.", openWeek: "Abrir el Altar Familiar de esta semana" },
  fr: { questions: (n: number) => `${n} question${n === 1 ? "" : "s"} à partager`, prayer: (n: number) => `${n} sujet${n === 1 ? "" : "s"} de prière`, open: "Ouvrir la dévotion du jour", preparing: "La dévotion du jour est en préparation.", openWeek: "Ouvrir l’Autel familial de la semaine" },
} as const;

function Flame({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1.2-.5-2-1-2.8 2.3 1 4 3.3 4 6.3a5.5 5.5 0 0 1-11 0C6.5 9.5 10 7.5 12 3Z" />
      <path d="M5 21h14" />
    </svg>
  );
}

/**
 * Today's Family Altar, featured on the empty new-chat screen: the top half
 * of the screen on phones, a card beside the welcome card on desktop.
 * Always rendered (loading placeholder of the same size, then today's
 * devotion, or a "being prepared" state that still links to the week).
 */
export function TodayAltarCard({ language }: { language: string }) {
  const lang: AltarLanguage = language === "es" || language === "fr" ? language : "en";
  const s = ALTAR_STRINGS[lang];
  const c = COPY[lang];
  const [state, setState] = useState<CardState>({ status: "loading" });
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    const today = localTodayIso();
    // Show the reader's language when it's generated; otherwise English.
    const contentLang = ALTAR_GENERATED_LANGUAGES.includes(lang) ? lang : "en";
    loadToday(today, contentLang).then((row) => {
      if (cancelled) return;
      setDateLabel(
        new Intl.DateTimeFormat(s.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`)),
      );
      setState(row ? { status: "ready", row } : { status: "none" });
    });
    return () => {
      cancelled = true;
    };
  }, [lang, s.locale]);

  return (
    <Link
      prefetch={false}
      href={altarHref(lang)}
      aria-busy={state.status === "loading"}
      className="group flex w-full flex-col gap-2.5 rounded-[22px] border border-amber-200/80 bg-amber-50/70 p-4 text-left transition-colors hover:border-amber-300 lg:max-w-md lg:gap-2 lg:p-5 dark:border-amber-800/40 dark:bg-amber-900/10 dark:hover:border-amber-700/60"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
          <Flame className="h-4 w-4" />
          {s.chatCardLabel}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{dateLabel}</span>
      </span>

      {state.status === "loading" && (
        <span className="flex flex-col gap-2" aria-hidden="true">
          <span className="h-5 w-11/12 animate-pulse rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="h-5 w-10/12 animate-pulse rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="h-5 w-7/12 animate-pulse rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="h-3 w-24 animate-pulse rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="mt-2 h-9 w-9/12 animate-pulse rounded bg-amber-100 dark:bg-amber-900/30" />
          <span className="mt-1 h-10 w-full animate-pulse rounded-xl bg-amber-100 dark:bg-amber-900/30" />
        </span>
      )}

      {state.status === "ready" && (
        <>
          <span className="flex flex-col gap-1.5">
            <span className="font-display line-clamp-4 text-[1.15rem] leading-[1.35] text-pretty text-foreground lg:line-clamp-3 lg:text-[1.1rem]">
              “{state.row.scripture_text}”
            </span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {state.row.scripture_ref} <span className="text-zinc-400 dark:text-zinc-500">· KJV</span>
            </span>
          </span>
          <span className="flex flex-col gap-0.5 border-t border-amber-200/80 pt-3 dark:border-amber-800/40">
            {state.row.title && <span className="text-[15px] font-semibold text-foreground">{state.row.title}</span>}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {c.questions(state.row.discussion_questions.length)} · {c.prayer(state.row.prayer_points.length)}
            </span>
          </span>
          <span className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm lg:py-2 font-medium text-white transition-colors group-hover:bg-amber-800 dark:bg-amber-500 dark:text-zinc-950 dark:group-hover:bg-amber-400">
            {c.open}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </>
      )}

      {state.status === "none" && (
        <span className="flex flex-col gap-3">
          <span className="font-display text-lg leading-snug text-foreground">{c.preparing}</span>
          <span className="flex items-center justify-center rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-900 dark:border-amber-700/60 dark:text-amber-200">
            {c.openWeek}
          </span>
        </span>
      )}
    </Link>
  );
}
