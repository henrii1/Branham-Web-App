import { FAQ_LANGUAGES, type FaqLanguage } from "@/lib/faq/entry";
import { getAdminUser } from "@/lib/faq/adminStore";
import { generateFaqAnswer, ModelApiError } from "@/lib/faq/modelApi";

/**
 * Generates one language's FAQ answer (one /api/chat call, ~30s). The dialog
 * calls this once per language in turn, so a failure only costs that
 * language and can be retried on its own.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    language?: string;
    question?: string;
    robust_query?: string;
    faq_kind?: string;
  } | null;
  const language = body?.language as FaqLanguage;
  const question = body?.question?.trim() ?? "";
  const robustQuery = body?.robust_query?.trim() ?? "";
  const kind = body?.faq_kind;
  if (!FAQ_LANGUAGES.includes(language) || !question || !robustQuery || robustQuery.length > 4000 || (kind !== "doctrinal" && kind !== "bible")) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await generateFaqAnswer(robustQuery, question, language, kind);
    return Response.json({ ok: true, result });
  } catch (err) {
    if (err instanceof ModelApiError) {
      return Response.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error(`FAQ generate (${language}) failed:`, err);
    return Response.json({ ok: false, error: "Couldn't generate this answer. Try again." }, { status: 500 });
  }
}
