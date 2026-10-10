import { getAdminUser } from "@/lib/faq/adminStore";
import { updateDayText } from "@/lib/altar/store";
import { isIsoDate } from "@/lib/altar/week";
import { ALTAR_LANGUAGES, type AltarEditableFields, type AltarLanguage } from "@/lib/altar/types";

const MAX_TEXT = 20_000;
const isStr = (v: unknown, max = MAX_TEXT) => typeof v === "string" && v.length <= max;
const isStrList = (v: unknown, maxItems: number) =>
  Array.isArray(v) && v.length <= maxItems && v.every((x) => isStr(x, 1_000));

/** Saves an admin's text edits to one published day. */
export async function POST(request: Request) {
  const user = await getAdminUser();
  if (!user) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    day?: string;
    language?: string;
    fields?: Partial<AltarEditableFields>;
  } | null;
  const day = body?.day ?? "";
  const language = body?.language as AltarLanguage;
  const f = body?.fields;
  if (
    !isIsoDate(day) ||
    !ALTAR_LANGUAGES.includes(language) ||
    !f ||
    !isStr(f.title, 200) ||
    !f.title?.trim() ||
    !isStr(f.reflection_markdown) ||
    !f.reflection_markdown?.trim() ||
    !isStr(f.sermon_quotes_markdown ?? "") ||
    !isStr(f.prayer_intro ?? "", 1_000) ||
    !isStrList(f.discussion_questions, 6) ||
    !isStrList(f.prayer_points, 8) ||
    !isStrList(f.sermon_references, 20)
  ) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  if (!f.discussion_questions!.some((q) => q.trim()) || !f.prayer_points!.some((p) => p.trim())) {
    return Response.json({ ok: false, error: "Keep at least one question and one prayer point." }, { status: 400 });
  }

  try {
    const saved = await updateDayText(
      day,
      language,
      {
        title: f.title!,
        reflection_markdown: f.reflection_markdown!,
        sermon_quotes_markdown: f.sermon_quotes_markdown ?? "",
        discussion_questions: f.discussion_questions!,
        prayer_intro: f.prayer_intro ?? "",
        prayer_points: f.prayer_points!,
        sermon_references: f.sermon_references!,
      },
      user.id,
    );
    if (!saved) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Altar update failed:", err);
    return Response.json({ ok: false, error: "Couldn't save. Your edit was not applied." }, { status: 500 });
  }
}
