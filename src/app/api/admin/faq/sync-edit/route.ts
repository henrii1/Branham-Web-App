import { createAdminClient } from "@/lib/supabase/admin";
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
  const enOk =
    en &&
    (["question_before", "question_after"] as const).every((k) => typeof en[k] === "string" && en[k]!.trim() && en[k]!.length <= QUESTION_MAX) &&
    (["answer_before", "answer_after"] as const).every((k) => typeof en[k] === "string" && en[k]!.trim() && en[k]!.length <= ANSWER_MAX);
  if (!enOk) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });

  try {
    let kind: FaqKind;
    let targets: Record<"es" | "fr", FaqSyncText>;
    const slug = body?.slug?.trim();
    if (slug) {
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
      const valid = (x?: Partial<FaqSyncText>) =>
        !!x && typeof x.question === "string" && !!x.question.trim() && x.question.length <= QUESTION_MAX && typeof x.answer === "string" && !!x.answer.trim() && x.answer.length <= ANSWER_MAX;
      if ((k !== "doctrinal" && k !== "bible") || !valid(t?.es) || !valid(t?.fr)) {
        return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
      }
      kind = k;
      targets = { es: t!.es as FaqSyncText, fr: t!.fr as FaqSyncText };
    }

    const result = await syncFaqEdit(kind, en as EnEdit, targets);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ModelApiError) {
      return Response.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("FAQ sync-edit failed:", err);
    return Response.json({ ok: false, error: "Couldn't update Spanish and French. Try again." }, { status: 500 });
  }
}
