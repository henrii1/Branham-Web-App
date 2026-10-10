import {
  faqMetaDescription,
  faqSlugify,
  FAQ_LANGUAGES,
  type FaqEntryDraft,
  type FaqLanguage,
} from "@/lib/faq/entry";
import { FaqSlugTakenError, getAdminUser, publishFaq } from "@/lib/faq/adminStore";

const MAX_ANSWER_CHARS = 40_000;

/** Writes all three language rows of a reviewed FAQ entry, published. */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    entries?: Partial<Record<FaqLanguage, FaqEntryDraft>>;
  } | null;
  const entries = body?.entries;
  if (!entries) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  for (const lang of FAQ_LANGUAGES) {
    const e = entries[lang];
    if (
      !e?.question?.trim() ||
      !e.robust_query?.trim() ||
      !e.answer_markdown?.trim() ||
      e.answer_markdown.length > MAX_ANSWER_CHARS ||
      typeof e.rag_context !== "string" ||
      !e.meta_title?.trim()
    ) {
      return Response.json({ ok: false, error: `incomplete_${lang}` }, { status: 400 });
    }
    // The admin may have edited the answer during review — keep the meta
    // description in step with what's actually stored.
    e.meta_description = faqMetaDescription(e.answer_markdown);
  }

  // The slug always comes from the (possibly edited) English title.
  const slug = faqSlugify(entries.en!.question);
  if (!slug) {
    return Response.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  try {
    await publishFaq(slug, entries as Record<FaqLanguage, FaqEntryDraft>);
    return Response.json({ ok: true, slug });
  } catch (err) {
    if (err instanceof FaqSlugTakenError) {
      return Response.json(
        { ok: false, error: "An FAQ with this question already exists. Reword the English question.", slug },
        { status: 409 },
      );
    }
    console.error("FAQ publish failed:", err);
    return Response.json({ ok: false, error: "Couldn't publish. Nothing was saved. Try again." }, { status: 500 });
  }
}
