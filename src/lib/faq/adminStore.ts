/**
 * Server-only seo_cache writes for the admin FAQ tools. seo_cache has only a
 * public read policy (published rows), so every write here goes through the
 * service-role client — callers must have checked getAdminUser() first.
 */

import { revalidateTag } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { FAQ_LIST_CACHE_TAG } from "@/lib/db/seo-queries";
import {
  faqMetaDescription,
  sanitizeForPostgres as clean,
  FAQ_LANGUAGES,
  type FaqEntryDraft,
  type FaqLanguage,
} from "./entry";

/** The signed-in user if they're one of the two admin accounts, else null. */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminEmail(user.email) ? user : null;
}

export interface FaqDuplicate {
  slug: string;
  question: string;
}

/**
 * An existing entry with this slug (any language, published or not), or an
 * English entry with the same question text under a different slug.
 */
export async function findFaqDuplicate(
  slug: string,
  englishQuestion: string,
): Promise<FaqDuplicate | null> {
  const admin = createAdminClient();

  const bySlug = await admin
    .from("seo_cache")
    .select("slug, question")
    .eq("slug", slug)
    .order("language", { ascending: true })
    .limit(1);
  if (bySlug.error) throw bySlug.error;
  if (bySlug.data?.length) return bySlug.data[0];

  const normalized = englishQuestion.trim();
  if (!normalized) return null;
  const byQuestion = await admin
    .from("seo_cache")
    .select("slug, question")
    .eq("language", "en")
    .ilike("question", normalized.replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(1);
  if (byQuestion.error) throw byQuestion.error;
  return byQuestion.data?.[0] ?? null;
}

export class FaqSlugTakenError extends Error {}

/** Insert all three language rows for a new FAQ entry, published. */
export async function publishFaq(
  slug: string,
  entries: Record<FaqLanguage, FaqEntryDraft>,
): Promise<void> {
  const admin = createAdminClient();
  const rows = FAQ_LANGUAGES.map((language) => ({
    slug,
    language,
    question: clean(entries[language].question.trim()),
    robust_query: clean(entries[language].robust_query),
    answer_markdown: clean(entries[language].answer_markdown),
    rag_context: clean(entries[language].rag_context),
    conversation_summary:
      entries[language].conversation_summary === null ? null : clean(entries[language].conversation_summary),
    meta_title: clean(entries[language].meta_title),
    meta_description: clean(entries[language].meta_description),
    published: true,
  }));

  // One insert statement, so all three rows land or none do. The
  // (slug, language) primary key turns a race with another publish of the
  // same slug into a unique violation instead of an overwrite.
  const { error } = await admin.from("seo_cache").insert(rows);
  if (error) {
    if (error.code === "23505") throw new FaqSlugTakenError(slug);
    throw error;
  }
  revalidateTag(FAQ_LIST_CACHE_TAG, { expire: 0 });
}

/** Update one language's question and answer on an existing FAQ entry. */
export async function updateFaq(
  slug: string,
  language: FaqLanguage,
  question: string,
  answerMarkdown: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("seo_cache")
    .update({
      question: clean(question.trim()),
      answer_markdown: clean(answerMarkdown),
      meta_description: clean(faqMetaDescription(answerMarkdown)),
    })
    .eq("slug", slug)
    .eq("language", language)
    .select("slug");
  if (error) throw error;
  if (!data?.length) return false;
  revalidateTag(FAQ_LIST_CACHE_TAG, { expire: 0 });
  return true;
}

/**
 * Delete an FAQ entry in every language (all rows sharing the slug), so the
 * question can later be generated again as a fresh three-language entry.
 * Returns how many rows were removed.
 */
export async function deleteFaq(slug: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("seo_cache").delete().eq("slug", slug).select("language");
  if (error) throw error;
  if (data?.length) revalidateTag(FAQ_LIST_CACHE_TAG, { expire: 0 });
  return data?.length ?? 0;
}
