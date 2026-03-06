import { createClient } from "@supabase/supabase-js";

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
): Promise<SeoCacheRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchAllPublishedSeoPages(): Promise<SeoCacheRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("seo_cache")
    .select(SEO_COLUMNS)
    .eq("published", true)
    .eq("language", "en")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
