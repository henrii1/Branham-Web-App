import { createAdminClient } from "@/lib/supabase/admin";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";
import { getAdminUser } from "@/lib/faq/adminStore";
import { ModelApiError, syncFaqEdit, type FaqSyncText } from "@/lib/faq/modelApi";
import type { FaqKind } from "@/lib/faq/groups";

const ANSWER_MAX = 40_000;
const QUESTION_MAX = 500;

type EnEdit = { question_before: string; question_after: string; answer_before: string; answer_after: string };

/**
 * "Update Spanish & French": proofreads the admin's English edit and applies
 * the same change to the Spanish and French texts (Model API
 * /api/faq/sync-edit). Saves nothing — the admin reviews the result.
 *
 * - Review step of Add to FAQ (nothing published yet): `faq_kind` and the
 *   current es/fr drafts (`targets`) come from the dialog.
 * - An answer the admin wrote: one target with an empty answer and an empty
 *   `answer_before` — the API writes that language in full.
 * - Edit FAQ on a published English page: `slug` — the kind (from the
 *   FAQ's group) and the current Spanish/French texts are read here.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    faq_kind?: string;
    en?: Partial<EnEdit>;
    targets?: Partial<Record<"es" | "fr", Partial<FaqSyncText>>>;
  } | null;

  const en = body?.en;
  // answer_before "" = translate in full (checked below: only with empty targets).
  const enOk =
    en &&
    (["question_before", "question_after"] as const).every((k) => typeof en[k] === "string" && en[k]!.trim() && en[k]!.length <= QUESTION_MAX) &&
    typeof en.answer_before === "string" &&
    en.answer_before.length <= ANSWER_MAX &&
    typeof en.answer_after === "string" &&
    !!en.answer_after.trim() &&
    en.answer_after.length <= ANSWER_MAX;
  if (!enOk) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  const writeInFull = !en.answer_before!.trim();

  try {
    let kind: FaqKind;
    let targets: Partial<Record<"es" | "fr", FaqSyncText>>;
    const slug = body?.slug?.trim();
    if (slug) {
      if (writeInFull) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      if (!/^[a-z0-9-]+$/.test(slug)) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      const admin = createAdminClient();
      const { data: rows, error } = await admin
        .from("seo_cache")
        .select("language, question, answer_markdown, group_id")
        .eq("slug", slug)
        .in("language", ["es", "fr"]);
      if (error) throw error;
      const es = rows?.find((r) => r.language === "es");
      const fr = rows?.find((r) => r.language === "fr");
      if (!es || !fr) return Response.json({ ok: false, error: "This FAQ has no Spanish or French page to update." }, { status: 404 });
      targets = { es: { question: es.question, answer: es.answer_markdown }, fr: { question: fr.question, answer: fr.answer_markdown } };
      const groupId = (es.group_id as string | null) ?? null;
      kind = "doctrinal";
      if (groupId) {
        const { data: g } = await admin.from("faq_groups").select("kind").eq("id", groupId).maybeSingle();
        if (g?.kind === "bible") kind = "bible";
      }
    } else {
      const k = body?.faq_kind;
      const t = body?.targets;
      // Writing in full: one or both targets, answers empty. Syncing an edit: both, with answers.
      const valid = (x?: Partial<FaqSyncText>) =>
        !!x &&
        typeof x.question === "string" &&
        !!x.question.trim() &&
        x.question.length <= QUESTION_MAX &&
        typeof x.answer === "string" &&
        (writeInFull ? x.answer === "" : !!x.answer.trim() && x.answer.length <= ANSWER_MAX);
      const langs = (["es", "fr"] as const).filter((l) => t?.[l]);
      if ((k !== "doctrinal" && k !== "bible") || !langs.every((l) => valid(t![l])) || (writeInFull ? langs.length === 0 : langs.length !== 2)) {
        return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      }
      kind = k;
      targets = Object.fromEntries(langs.map((l) => [l, t![l] as FaqSyncText]));
    }

    const result = await syncFaqEdit(kind, en as EnEdit, targets);
    if (writeInFull) {
      // A translation written in full can open with "Respuesta:"/"Réponse:"; generated answers are stored without it.
      for (const l of ["es", "fr"] as const) {
        const t = result[l];
        if (t) t.answer = stripAnswerPrefix(t.answer).trim();
      }
    }
    return Response.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ModelApiError) {
      return Response.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("FAQ sync-edit failed:", err);
    return Response.json({ ok: false, error: "Couldn't update Spanish and French. Try again." }, { status: 500 });
  }
}
