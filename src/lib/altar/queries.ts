import { createClient } from "@supabase/supabase-js";
import { ALTAR_PUBLIC_COLUMNS, type AltarLanguage, type FamilyAltarDay } from "./types";
import { addDays, mondayOf, utcTodayIso } from "./week";

function getPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function fetchRange(languages: AltarLanguage[], from: string, to?: string): Promise<FamilyAltarDay[]> {
  let q = getPublicClient()
    .from("family_altar_days")
    .select(ALTAR_PUBLIC_COLUMNS)
    .in("language", languages)
    .eq("status", "ready")
    .gte("day", from);
  if (to) q = q.lte("day", to);
  const { data, error } = await q.order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyAltarDay[];
}

/**
 * Published Family Altar days for the page: from the previous UTC week on
 * (a reader behind UTC can still be in it), plus the week of `focusDay`
 * when a day link points further back. Past days are kept forever so shared
 * links keep working; RLS only exposes status = 'ready' rows of weeks that
 * have started (migration 015).
 */
export async function fetchPublishedAltarDays(languages: AltarLanguage[], focusDay?: string): Promise<FamilyAltarDay[]> {
  const from = addDays(mondayOf(utcTodayIso()), -7);
  const focusWeek = focusDay ? mondayOf(focusDay) : null;
  const [recent, focused] = await Promise.all([
    fetchRange(languages, from),
    focusWeek && focusWeek < from ? fetchRange(languages, focusWeek, addDays(focusWeek, 6)) : Promise.resolve([]),
  ]);
  return [...focused, ...recent];
}

/** One published day, in the first of `languages` that has it (link previews). */
export async function fetchPublishedAltarDay(day: string, languages: AltarLanguage[]): Promise<FamilyAltarDay | null> {
  const rows = await fetchRange(languages, day, day);
  return languages.map((l) => rows.find((r) => r.language === l)).find(Boolean) ?? null;
}
