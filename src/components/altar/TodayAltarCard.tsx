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
}

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
          .select("scripture_ref, scripture_text, title")
          .eq("day", day)
          .eq("language", language)
          .eq("status", "ready")
          .maybeSingle(),
      ).then(({ data }) => (data as TodayRow | null) ?? null, () => null),
    );
  }
  return cache.get(key)!;
}

const clip = (text: string, max = 150) => (text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text);

/** "Today's Family Altar" card on the empty new-chat screen. */
export function TodayAltarCard({ language }: { language: string }) {
  const lang: AltarLanguage = language === "es" || language === "fr" ? language : "en";
  const s = ALTAR_STRINGS[lang];
  const [row, setRow] = useState<TodayRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Show the reader's language when it's generated; otherwise English.
    const contentLang = ALTAR_GENERATED_LANGUAGES.includes(lang) ? lang : "en";
    loadToday(localTodayIso(), contentLang).then((r) => {
      if (!cancelled) setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (!row) return null;

  return (
    <Link
      prefetch={false}
      href={altarHref(lang)}
      className="mt-5 flex w-full max-w-lg items-start gap-3 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-3.5 text-left shadow-sm transition-colors hover:border-amber-300 dark:border-zinc-700 dark:hover:border-amber-800"
    >
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1.2-.5-2-1-2.8 2.3 1 4 3.3 4 6.3a5.5 5.5 0 0 1-11 0C6.5 9.5 10 7.5 12 3Z" />
        <path d="M5 21h14" />
      </svg>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">{s.chatCardLabel}</span>
        <span className="font-display text-[15px] leading-snug text-foreground">
          “{clip(row.scripture_text)}” <span className="font-sans text-xs whitespace-nowrap text-zinc-500">{row.scripture_ref}</span>
        </span>
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{s.chatCardLink}</span>
      </span>
    </Link>
  );
}
