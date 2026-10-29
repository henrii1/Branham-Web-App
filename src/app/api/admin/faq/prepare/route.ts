import { faqSlugify } from "@/lib/faq/entry";
import { findFaqDuplicate, getAdminUser, getFaqGroup, listFaqGroups } from "@/lib/faq/adminStore";
import { MAX_GROUP_NAME_CHARS, MAX_GUIDANCE_CHARS, type FaqKind } from "@/lib/faq/groups";
import { ModelApiError, prepareFaqQuestion } from "@/lib/faq/modelApi";

/**
 * Shapes the admin's question into the public FAQ title + search query in
 * en/es/fr (Model API /api/faq/translate), then re-runs the duplicate check
 * on the slug of the shaped English title.
 *
 * The question goes into an existing group (`group_id`) or a new one
 * (`new_group_name`, English). The kind is decided here, never by the
 * client: the doctrinal group → "doctrinal", any other or a new group →
 * "bible". A new group's name is translated in the same call.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    question?: string;
    group_id?: string;
    new_group_name?: string;
    faq_guidance?: string;
  } | null;
  const guidance = body?.faq_guidance?.trim() || undefined;
  if (guidance && guidance.length > MAX_GUIDANCE_CHARS) {
    return Response.json({ ok: false, error: `Keep the guidance under ${MAX_GUIDANCE_CHARS} characters.` }, { status: 400 });
  }
  const question = body?.question?.trim() ?? "";
  const groupId = body?.group_id?.trim() || null;
  const newGroupName = body?.new_group_name?.replace(/\s+/g, " ").trim() || null;
  if (question.length < 3 || question.length > 500) {
    return Response.json({ ok: false, error: "invalid_question" }, { status: 400 });
  }
  if (!groupId === !newGroupName || (newGroupName && newGroupName.length > MAX_GROUP_NAME_CHARS)) {
    return Response.json({ ok: false, error: "Choose a group, or name a new one (up to 80 characters)." }, { status: 400 });
  }

  try {
    let kind: FaqKind = "bible";
    if (groupId) {
      const group = await getFaqGroup(groupId);
      if (!group) return Response.json({ ok: false, error: "That group no longer exists. Choose another." }, { status: 404 });
      kind = group.kind;
    } else {
      const taken = (await listFaqGroups()).find((g) => g.name_en.toLowerCase() === newGroupName!.toLowerCase());
      if (taken) {
        return Response.json({ ok: false, error: `A group called "${taken.name_en}" already exists. Choose it from the list.` }, { status: 409 });
      }
    }
    const results = await prepareFaqQuestion(question, kind, newGroupName ?? undefined, guidance);
    const slug = faqSlugify(results.en.question);
    const duplicate = await findFaqDuplicate(slug, results.en.question);
    return Response.json({ ok: true, slug, results, duplicate, kind });
  } catch (err) {
    if (err instanceof ModelApiError) {
      return Response.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("FAQ prepare failed:", err);
    return Response.json({ ok: false, error: "Couldn't prepare the question. Try again." }, { status: 500 });
  }
}
