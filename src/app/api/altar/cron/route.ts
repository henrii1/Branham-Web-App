import { timingSafeEqual } from "node:crypto";
import { generateAndStoreDay, generateWeek, nextWeekStart, pruneOldDays } from "@/lib/altar/store";
import { mondayOf, utcTodayIso, weekDays } from "@/lib/altar/week";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALTAR_GENERATED_LANGUAGES } from "@/lib/altar/types";

/**
 * Family Altar run, called by the Worker's scheduled() handler
 * (custom-worker.ts) every day at 12:00 UTC with the CRON_SECRET header.
 *   1. delete days before the current week,
 *   2. fill any missing days of the current week from today on,
 *   3. generate next week's missing days.
 * Published days are always skipped, so a run with nothing missing makes no
 * Model API calls, and a day that failed is retried by the next day's run.
 */
function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const started = Date.now();
  await pruneOldDays();

  // Fill gaps in the current week (today onward), e.g. after a failed run.
  const today = utcTodayIso();
  const admin = createAdminClient();
  const filled = [];
  for (const language of ALTAR_GENERATED_LANGUAGES) {
    const { data } = await admin
      .from("family_altar_days")
      .select("day")
      .eq("language", language)
      .eq("week_start", mondayOf(today))
      .eq("status", "ready");
    const ready = new Set((data ?? []).map((r) => r.day as string));
    for (const day of weekDays(mondayOf(today))) {
      if (day >= today && !ready.has(day)) filled.push(await generateAndStoreDay(day, language));
    }
  }

  const next = await generateWeek(nextWeekStart());
  const results = [...filled, ...next];
  const failed = results.filter((r) => !r.ok);
  console.log(
    `Family Altar cron: ${results.length - failed.length}/${results.length} days generated in ${Math.round((Date.now() - started) / 1000)}s`,
    failed.length ? failed : "",
  );
  return Response.json({ ok: failed.length === 0, generated: results.length - failed.length, failed });
}
