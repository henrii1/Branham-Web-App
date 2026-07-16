import { createClient } from "@supabase/supabase-js";
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
  created_at: string;
  updated_at: string;
}

const SEO_COLUMNS =
  "slug, question, robust_query, answer_markdown, rag_context, conversation_summary, language, published, meta_title, meta_description, created_at, updated_at" as const;

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

export const fetchFaqListItems = (language = "en") =>
  unstable_cache(
    async () => {
      const supabase = getPublicClient();
      const { data, error } = await supabase
        .from("seo_cache")
        .select("slug, question, meta_description")
        .eq("published", true)
        .eq("language", language)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<
        SeoCacheRow,
        "slug" | "question" | "meta_description"
      >[];
    },
    ["faq-list", language],
    { revalidate: 3600 },
  )();

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
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx < pages.length - 1 ? pages[idx + 1] : null,
  };
}
