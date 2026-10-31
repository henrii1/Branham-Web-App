import { createClient } from "@supabase/supabase-js";
import { FAQ_GROUP_COLUMNS, isFollowupFaqKind, type FaqGroup, type FollowupFaqKind } from "@/lib/faq/groups";
import { unstable_cache } from "next/cache";

export interface SeoCacheRow {
  slug: string;
  question: string;
  robust_query: string;
  answer_markdown: string;
  rag_context: string;
  conversation_summary: string | null;
  language: string;
  published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export const FAQ_LIST_CACHE_TAG = "faq-list";

const SEO_COLUMNS =
  "slug, question, robust_query, answer_markdown, rag_context, conversation_summary, language, published, meta_title, meta_description, group_id, created_at, updated_at" as const;

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function fetchSeoPage(
  slug: string,
  language = "en",
): Promise<SeoCacheRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("slug", slug)
    .eq("language", language)
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// EN-only by design — used on the landing page which is always English.
export async function fetchTopPublishedSeoPages(
  limit = 8,
): Promise<Pick<SeoCacheRow, "slug" | "question">[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select("slug, question")
    .eq("published", true)
    .eq("language", "en")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchAllPublishedSeoPages(language = "en"): Promise<SeoCacheRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("published", true)
    .eq("language", language)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export type FaqListRow = Pick<SeoCacheRow, "slug" | "question" | "meta_description"> & { group_id: string | null };

export const fetchFaqListItems = (language = "en") =>
  unstable_cache(
    async (): Promise<FaqListRow[]> => {
      const supabase = getPublicClient();
      const query = (columns: string) =>
        supabase
          .from("seo_cache")
          .select(columns)
          .eq("published", true)
          .eq("language", language)
          .order("created_at", { ascending: true });
      let { data, error } = await query("slug, question, meta_description, group_id");
      // 42703: group_id doesn't exist yet (migration 016 not run) — list
      // without groups rather than breaking the FAQ page.
      if (error?.code === "42703") ({ data, error } = await query("slug, question, meta_description"));
      if (error) throw error;
      return ((data ?? []) as unknown as FaqListRow[]).map((r) => ({ ...r, group_id: r.group_id ?? null }));
    },
    ["faq-list", language],
    // Tagged so admin publish/edit routes can expire it immediately.
    { revalidate: 3600, tags: [FAQ_LIST_CACHE_TAG] },
  )();

/** All FAQ groups ([] if the table doesn't exist yet). Same cache tag as the list. */
export const fetchFaqGroups = () =>
  unstable_cache(
    async (): Promise<FaqGroup[]> => {
      const { data, error } = await getPublicClient()
        .from("faq_groups")
        .select(FAQ_GROUP_COLUMNS)
        .order("created_at", { ascending: true });
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return [];
        throw error;
      }
      return (data ?? []) as FaqGroup[];
    },
    ["faq-groups"],
    { revalidate: 3600, tags: [FAQ_LIST_CACHE_TAG] },
  )();

/** The page's group kind when its follow-ups are answered from Scripture. */
export async function fetchFollowupKind(groupId: string | null): Promise<FollowupFaqKind | null> {
  if (!groupId) return null;
  const kind = (await fetchFaqGroups()).find((g) => g.id === groupId)?.kind;
  return isFollowupFaqKind(kind) ? kind : null;
}

export interface AdjacentSeoPage {
  slug: string;
  question: string;
}

/**
 * Returns the previous and next published SEO page relative to `slug`,
 * ordered by created_at ascending. Used to wire up internal cross-links
 * (rel="prev" / rel="next" in head + visible "Next →" footer) so each
 * /q page is no longer a dead-end leaf with no peer links — a known
 * cause of "crawled — currently not indexed" in Search Console.
 */
export async function fetchAdjacentSeoPages(slug: string, language = "en"): Promise<{
  prev: AdjacentSeoPage | null;
  next: AdjacentSeoPage | null;
  /** The visible "Next" link: like `next`, but the newest page wraps around
   * to the first, so FAQs added from the admin tools (always last) still
   * lead somewhere. `prev`/`next` stay linear for rel="prev"/"next". */
  nextWrapped: AdjacentSeoPage | null;
}> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select("slug, question")
    .eq("published", true)
    .eq("language", language)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const pages = (data ?? []) as AdjacentSeoPage[];
  const idx = pages.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null, nextWrapped: null };
  const next = idx < pages.length - 1 ? pages[idx + 1] : null;
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next,
    nextWrapped: next ?? (pages.length > 1 ? pages[0] : null),
  };
}
