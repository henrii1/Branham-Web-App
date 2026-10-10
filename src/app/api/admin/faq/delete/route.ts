import { deleteFaq, getAdminUser } from "@/lib/faq/adminStore";

/** Deletes an FAQ entry in all three languages (every row with the slug). */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug?.trim() ?? "";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const deleted = await deleteFaq(slug);
    if (!deleted) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, deleted });
  } catch (err) {
    console.error("FAQ delete failed:", err);
    return Response.json({ ok: false, error: "Couldn't delete. Nothing was removed." }, { status: 500 });
  }
}
