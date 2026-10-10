import { FAQ_LANGUAGES, type FaqLanguage } from "@/lib/faq/entry";
import { getAdminUser, updateFaq } from "@/lib/faq/adminStore";

const MAX_ANSWER_CHARS = 40_000;

/**
 * Saves an admin's edit to one language of an existing FAQ entry. The slug
 * never changes on edit, so existing links keep working.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    language?: string;
    question?: string;
    answer_markdown?: string;
  } | null;
  const slug = body?.slug?.trim() ?? "";
  const language = body?.language as FaqLanguage;
  const question = body?.question?.trim() ?? "";
  const answer = body?.answer_markdown ?? "";

  if (
    !/^[a-z0-9-]+$/.test(slug) ||
    !FAQ_LANGUAGES.includes(language) ||
    question.length < 3 ||
    question.length > 500 ||
    !answer.trim() ||
    answer.length > MAX_ANSWER_CHARS
  ) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const found = await updateFaq(slug, language, question, answer);
    if (!found) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("FAQ update failed:", err);
    return Response.json({ ok: false, error: "Couldn't save. Your edit was not applied." }, { status: 500 });
  }
}
