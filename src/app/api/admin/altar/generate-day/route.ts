import { getAdminUser } from "@/lib/faq/adminStore";
import { generateAndStoreDay } from "@/lib/altar/store";
import { addDays, isIsoDate, mondayOf, utcTodayIso } from "@/lib/altar/week";

/**
 * Generate or regenerate one day's devotional (one Model API call, ~30s).
 * `reference` swaps the day's verse. Limited to the weeks the table keeps:
 * the current week and the next (UTC), with a day's grace either side for
 * readers in other time zones.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { day?: string; reference?: string } | null;
  const day = body?.day ?? "";
  const reference = body?.reference?.trim() || undefined;
  if (!isIsoDate(day) || (reference && reference.length > 60)) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const currentMonday = mondayOf(utcTodayIso());
  if (day < addDays(currentMonday, -1) || day > addDays(currentMonday, 14)) {
    return Response.json({ ok: false, error: "Only this week and next week can be generated." }, { status: 400 });
  }

  try {
    const result = await generateAndStoreDay(day, "en", reference);
    return Response.json({ ok: result.ok, result }, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error("Altar generate-day failed:", err);
    return Response.json({ ok: false, error: "Couldn't generate this day. Try again." }, { status: 500 });
  }
}
