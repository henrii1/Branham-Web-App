/**
 * Server-only family_altar_days writes (service-role client; the table has
 * only a public read policy for finished days). Used by the weekly cron
 * route and the admin routes.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeForPostgres as clean } from "@/lib/faq/entry";
import { fetchKjvPassage, KjvLookupError } from "./kjv";
import { DevotionalError, generateDevotional } from "./generate";
import { addDays, defaultVerseFor, mondayOf, utcTodayIso, weekDays } from "./week";
import {
  ALTAR_GENERATED_LANGUAGES,
  ALTAR_PUBLIC_COLUMNS,
  type AltarEditableFields,
  type AltarLanguage,
  type FamilyAltarDay,
} from "./types";

const TABLE = "family_altar_days";

/** Every row (any status) for the given weeks — the admin view. */
export async function fetchWeeksForAdmin(weekStarts: string[], language: AltarLanguage): Promise<FamilyAltarDay[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .select(ALTAR_PUBLIC_COLUMNS)
    .eq("language", language)
    .in("week_start", weekStarts)
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyAltarDay[];
}

export interface DayResult {
  day: string;
  language: AltarLanguage;
  ok: boolean;
  scripture_ref?: string;
  error?: string;
  /** True when a previously published version was kept because regeneration failed. */
  keptPrevious?: boolean;
}

/**
 * Generate (or regenerate) one day. `reference` swaps the verse; otherwise
 * the day keeps its current verse, or gets the default for its date.
 * A day that is already published keeps its published content if the new
 * generation fails.
 */
export async function generateAndStoreDay(
  day: string,
  language: AltarLanguage,
  reference?: string,
): Promise<DayResult> {
  const admin = createAdminClient();
  const existing = await admin.from(TABLE).select("status, scripture_ref").eq("day", day).eq("language", language).maybeSingle();
  if (existing.error) throw existing.error;
  const wasReady = existing.data?.status === "ready";
  const ref = reference?.trim() || existing.data?.scripture_ref || defaultVerseFor(day);

  const fail = async (message: string): Promise<DayResult> => {
    if (wasReady) return { day, language, ok: false, error: message, keptPrevious: true };
    await admin.from(TABLE).upsert({
      day,
      language,
      week_start: mondayOf(day),
      scripture_ref: ref,
      scripture_text: "",
      status: "failed",
      error: clean(message),
    });
    return { day, language, ok: false, scripture_ref: ref, error: message };
  };

  let passage;
  try {
    passage = await fetchKjvPassage(ref);
  } catch (err) {
    return fail(err instanceof KjvLookupError ? err.message : "Couldn't fetch the Bible text. Try again.");
  }

  if (!wasReady) {
    await admin.from(TABLE).upsert({
      day,
      language,
      week_start: mondayOf(day),
      scripture_ref: passage.reference,
      scripture_text: clean(passage.text),
      status: "generating",
      error: null,
    });
  }

  let dev;
  try {
    dev = await generateDevotional(passage, language, day);
  } catch (err) {
    return fail(err instanceof DevotionalError ? err.message : "Couldn't write the devotional. Try again.");
  }

  const { error } = await admin.from(TABLE).upsert({
    day,
    language,
    week_start: mondayOf(day),
    scripture_ref: passage.reference,
    bible_version: "KJV",
    scripture_text: clean(passage.text),
    title: clean(dev.title),
    reflection_markdown: clean(dev.reflection_markdown),
    sermon_quotes_markdown: dev.sermon_quotes_markdown === null ? null : clean(dev.sermon_quotes_markdown),
    discussion_questions: dev.discussion_questions.map(clean),
    prayer_intro: dev.prayer_intro === null ? null : clean(dev.prayer_intro),
    prayer_points: dev.prayer_points.map(clean),
    sermon_references: dev.sermon_references.map(clean),
    answer_markdown: clean(dev.answer_markdown),
    rag_context: clean(dev.rag_context),
    status: "ready",
    error: null,
    generated_at: new Date().toISOString(),
    edited_at: null,
    edited_by: null,
  });
  if (error) return fail("Couldn't save the devotional. Try again.");
  return { day, language, ok: true, scripture_ref: passage.reference };
}

/** Save an admin's text edits to one day. */
export async function updateDayText(
  day: string,
  language: AltarLanguage,
  fields: AltarEditableFields,
  editorId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .update({
      title: clean(fields.title.trim()),
      reflection_markdown: clean(fields.reflection_markdown),
      sermon_quotes_markdown: fields.sermon_quotes_markdown.trim() ? clean(fields.sermon_quotes_markdown) : null,
      discussion_questions: fields.discussion_questions.map((q) => clean(q.trim())).filter(Boolean),
      prayer_intro: fields.prayer_intro.trim() ? clean(fields.prayer_intro.trim()) : null,
      prayer_points: fields.prayer_points.map((p) => clean(p.trim())).filter(Boolean),
      sermon_references: fields.sermon_references.map((r) => clean(r.trim())).filter(Boolean),
      edited_at: new Date().toISOString(),
      edited_by: editorId,
    })
    .eq("day", day)
    .eq("language", language)
    .eq("status", "ready")
    .select("day");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** The Monday of the week after the one containing `now` (UTC). */
export function nextWeekStart(now: Date = new Date()): string {
  return addDays(mondayOf(utcTodayIso(now)), 7);
}

/**
 * Generate every day of a week that isn't already published, in every
 * generated language, one at a time. Used by the weekly cron.
 */
export async function generateWeek(weekStart: string): Promise<DayResult[]> {
  const admin = createAdminClient();
  const results: DayResult[] = [];
  for (const language of ALTAR_GENERATED_LANGUAGES) {
    const { data } = await admin.from(TABLE).select("day").eq("language", language).eq("week_start", weekStart).eq("status", "ready");
    const ready = new Set((data ?? []).map((r) => r.day as string));
    for (const day of weekDays(weekStart)) {
      if (ready.has(day)) continue;
      results.push(await generateAndStoreDay(day, language));
    }
  }
  return results;
}
