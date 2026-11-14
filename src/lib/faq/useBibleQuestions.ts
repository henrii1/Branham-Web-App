"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HOME_FEATURED_GROUPS } from "@/lib/site/home";

export interface AnsweredQuestion {
  slug: string;
  question: string;
  group: string;
}

export interface BibleQuestionSet {
  all: AnsweredQuestion[];
  /** First question of each featured group (everyday growth questions). */
  featured: AnsweredQuestion[];
}

const cache = new Map<string, Promise<BibleQuestionSet>>();

async function load(lang: string): Promise<BibleQuestionSet> {
  const supabase = createClient();
  const [{ data: groups }, { data: rows }] = await Promise.all([
    supabase.from("faq_groups").select("id, name_en, name_es, name_fr, created_at").eq("kind", "bible").order("created_at", { ascending: true }),
    supabase.from("seo_cache").select("slug, question, group_id").eq("published", true).eq("language", lang).order("created_at", { ascending: true }),
  ]);
  if (!groups || !rows) return { all: [], featured: [] };
  const name = (g: (typeof groups)[number]) => (lang === "es" ? g.name_es : lang === "fr" ? g.name_fr : g.name_en);
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  const all: AnsweredQuestion[] = [];
  const firstOf = new Map<string, AnsweredQuestion>();
  for (const g of groups) {
    for (const r of rows) {
      if (r.group_id !== g.id) continue;
      const q = { slug: r.slug, question: r.question, group: name(byGroup.get(g.id)!) };
      all.push(q);
      if (!firstOf.has(g.id)) firstOf.set(g.id, q);
    }
  }
  const featured = HOME_FEATURED_GROUPS.map((n) => groups.find((g) => g.name_en.toLowerCase() === n.toLowerCase()))
    .map((g) => (g ? firstOf.get(g.id) : undefined))
    .filter((q): q is AnsweredQuestion => !!q);
  return { all, featured };
}

/** The Bible questions already answered, in one language (fetched once per language). Null while loading. */
export function useBibleQuestions(lang: string, enabled = true): BibleQuestionSet | null {
  const [data, setData] = useState<{ lang: string; set: BibleQuestionSet } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (!cache.has(lang)) cache.set(lang, load(lang).catch(() => ({ all: [], featured: [] })));
    cache.get(lang)!.then((set) => {
      if (!cancelled) setData({ lang, set });
    });
    return () => {
      cancelled = true;
    };
  }, [lang, enabled]);
  return data && data.lang === lang ? data.set : null;
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const STOP = new Set([
  "what", "does", "bible", "teach", "about", "with", "that", "this", "when", "will", "should", "there", "their", "have", "from", "your", "into", "they",
  "biblia", "sobre", "ensena", "como", "para", "puedo", "bible", "enseigne", "quoi", "comment", "dans", "pour", "est-ce", "elle", "elles",
]);

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));

/** Answered questions whose words match a search (all words, accent-insensitive). */
export function searchAnswered(all: AnsweredQuestion[], query: string, limit = 6): AnsweredQuestion[] {
  const ws = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  return all.filter((q) => ws.every((w) => fold(`${q.question} ${q.group}`).includes(w))).slice(0, limit);
}

/** The answered question sharing the most words with a new question (at least one), for "While you wait". */
export function closestAnswered(all: AnsweredQuestion[], query: string): AnsweredQuestion | null {
  const qw = new Set(words(query));
  if (!qw.size) return null;
  let best: AnsweredQuestion | null = null;
  let bestScore = 0;
  for (const q of all) {
    const score = words(`${q.question} ${q.group}`).filter((w) => qw.has(w) || [...qw].some((x) => x.length > 4 && (w.startsWith(x.slice(0, 5)) || x.startsWith(w.slice(0, 5))))).length;
    if (score > bestScore && fold(q.question) !== fold(query)) {
      best = q;
      bestScore = score;
    }
  }
  return best;
}
