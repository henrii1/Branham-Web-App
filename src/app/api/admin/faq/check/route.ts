import { faqSlugify } from "@/lib/faq/entry";
import { findFaqDuplicate, getAdminUser } from "@/lib/faq/adminStore";

/**
 * Duplicate check run as soon as the Add-to-FAQ dialog opens and whenever
 * the question is edited: an existing entry with the same slug, or the same
 * English question text.
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

  const slug = faqSlugify(question);
  try {
    const duplicate = await findFaqDuplicate(slug, question);
    return Response.json({ ok: true, slug, duplicate });
  } catch (err) {
    console.error("FAQ duplicate check failed:", err);
    return Response.json({ ok: false, error: "check_failed" }, { status: 500 });
  }
}
