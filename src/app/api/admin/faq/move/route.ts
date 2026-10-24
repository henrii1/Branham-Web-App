import { getAdminUser, getFaqGroup, moveFaqToGroup } from "@/lib/faq/adminStore";

/**
 * Moves an FAQ (all three languages) to another group. Only the listing
 * changes: the answer is not regenerated, and the page address stays.
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { slug?: string; group_id?: string } | null;
  const slug = body?.slug?.trim() ?? "";
  const groupId = body?.group_id?.trim() ?? "";
  if (!/^[a-z0-9-]+$/.test(slug) || !groupId) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  try {
    if (!(await getFaqGroup(groupId))) return Response.json({ ok: false, error: "That group no longer exists." }, { status: 404 });
    const found = await moveFaqToGroup(slug, groupId);
    if (!found) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("FAQ move failed:", err);
    return Response.json({ ok: false, error: "Couldn't move this FAQ. Nothing changed." }, { status: 500 });
  }
}
