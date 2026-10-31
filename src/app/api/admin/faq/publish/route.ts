import {
  faqMetaDescription,
  faqSlugify,
  FAQ_LANGUAGES,
  type FaqEntryDraft,
  type FaqLanguage,
} from "@/lib/faq/entry";
import {
  createFaqGroup,
  deleteEmptyFaqGroup,
  FaqGroupNameTakenError,
  FaqSlugTakenError,
  getAdminUser,
  getFaqGroup,
  publishFaq,
} from "@/lib/faq/adminStore";
import { MAX_GROUP_NAME_CHARS } from "@/lib/faq/groups";

const MAX_ANSWER_CHARS = 40_000;

/**
 * Writes all three language rows of a reviewed FAQ entry, published, into
 * its group: an existing one (`group.id`) or a new nature or Bible group
 * (`group.kind`) created here from its reviewed names (`group.names`). If the entry can't be saved, a
 * group created for it is removed again.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    entries?: Partial<Record<FaqLanguage, FaqEntryDraft>>;
    group?: { id?: string; names?: Partial<Record<FaqLanguage, string>>; kind?: string };
  } | null;
  const entries = body?.entries;
  const groupId = body?.group?.id?.trim() || null;
  const groupNames = body?.group?.names ?? null;
  const newGroupKind = body?.group?.kind === "nature" ? "nature" : "bible";
  if (!entries || !groupId === !groupNames) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  if (groupNames && FAQ_LANGUAGES.some((l) => !groupNames[l]?.trim() || groupNames[l]!.trim().length > MAX_GROUP_NAME_CHARS)) {
    return Response.json({ ok: false, error: "Each language needs a group name (up to 80 characters)." }, { status: 400 });
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

  let createdGroupId: string | null = null;
  try {
    let targetGroupId: string;
    if (groupId) {
      if (!(await getFaqGroup(groupId))) {
        return Response.json({ ok: false, error: "That group no longer exists. Nothing was saved." }, { status: 404 });
      }
      targetGroupId = groupId;
    } else {
      const group = await createFaqGroup(groupNames as Record<FaqLanguage, string>, newGroupKind);
      createdGroupId = group.id;
      targetGroupId = group.id;
    }
    await publishFaq(slug, entries as Record<FaqLanguage, FaqEntryDraft>, targetGroupId);
    return Response.json({ ok: true, slug, group_id: targetGroupId });
  } catch (err) {
    if (createdGroupId) await deleteEmptyFaqGroup(createdGroupId).catch(() => {});
    if (err instanceof FaqGroupNameTakenError) {
      return Response.json({ ok: false, error: "A group with this English name already exists. Nothing was saved." }, { status: 409 });
    }
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
