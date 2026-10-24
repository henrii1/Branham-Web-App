import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser, listFaqGroups } from "@/lib/faq/adminStore";

/**
 * The FAQ groups, for the Add-to-FAQ and Edit-FAQ group pickers. With a
 * `slug`, also that FAQ's current group (`current_group_id`, null if none).
 */
export async function POST(request: Request) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug?.trim();
  try {
    const groups = await listFaqGroups();
    let currentGroupId: string | null = null;
    if (slug && /^[a-z0-9-]+$/.test(slug)) {
      const { data } = await createAdminClient().from("seo_cache").select("group_id").eq("slug", slug).limit(1).maybeSingle();
      currentGroupId = (data?.group_id as string | null) ?? null;
    }
    return Response.json({ ok: true, groups, current_group_id: currentGroupId });
  } catch (err) {
    console.error("FAQ groups list failed:", err);
    return Response.json({ ok: false, error: "Couldn't load the groups." }, { status: 500 });
  }
}
