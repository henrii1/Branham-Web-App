import { faqSlugify } from "@/lib/faq/entry";
import { findFaqDuplicate, getAdminUser } from "@/lib/faq/adminStore";
import { ModelApiError, prepareFaqQuestion } from "@/lib/faq/modelApi";

/**
 * Shapes the admin's question into the public FAQ title + search query in
 * en/es/fr (Model API /api/faq/translate), then re-runs the duplicate check
 * on the slug of the shaped English title.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim() ?? "";
  if (question.length < 3 || question.length > 500) {
    return Response.json({ ok: false, error: "invalid_question" }, { status: 400 });
  }

  try {
    const results = await prepareFaqQuestion(question);
    const slug = faqSlugify(results.en.question);
    const duplicate = await findFaqDuplicate(slug, results.en.question);
    return Response.json({ ok: true, slug, results, duplicate });
  } catch (err) {
    if (err instanceof ModelApiError) {
      return Response.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("FAQ prepare failed:", err);
    return Response.json({ ok: false, error: "Couldn't prepare the question. Try again." }, { status: 500 });
  }
}
