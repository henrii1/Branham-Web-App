import { getAdminUser } from "@/lib/faq/adminStore";
import { fetchWeeksForAdmin } from "@/lib/altar/store";
import { ALTAR_LANGUAGES, type AltarLanguage } from "@/lib/altar/types";
import { defaultVerseFor, isIsoDate, mondayOf, weekDays } from "@/lib/altar/week";

/**
 * Admin view of one week: every day's row in any status (pending, failed,
 * ready), plus the default verse for days with no row yet.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { week_start?: string; language?: string } | null;
  const weekStart = body?.week_start ?? "";
  const language = (body?.language ?? "en") as AltarLanguage;
  if (!isIsoDate(weekStart) || mondayOf(weekStart) !== weekStart || !ALTAR_LANGUAGES.includes(language)) {
    return Response.json({ ok: false, error: "invalid_week" }, { status: 400 });
  }
  try {
    const rows = await fetchWeeksForAdmin([weekStart], language);
    const defaults = Object.fromEntries(weekDays(weekStart).map((d) => [d, defaultVerseFor(d)]));
    return Response.json({ ok: true, rows, defaults });
  } catch (err) {
    console.error("Altar admin week failed:", err);
    return Response.json({ ok: false, error: "Couldn't load the week." }, { status: 500 });
  }
}
