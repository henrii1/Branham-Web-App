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
import { FAQ_GROUP_COLUMNS, type FaqGroup, type FaqSectionKind } from "./groups";

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

// ── Groups ──────────────────────────────────────────────────────────────

export async function listFaqGroups(): Promise<FaqGroup[]> {
  const { data, error } = await createAdminClient()
    .from("faq_groups")
    .select(FAQ_GROUP_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FaqGroup[];
}

export async function getFaqGroup(id: string): Promise<FaqGroup | null> {
  const { data, error } = await createAdminClient().from("faq_groups").select(FAQ_GROUP_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as FaqGroup | null) ?? null;
}

export class FaqGroupNameTakenError extends Error {}

/**
 * Create a nature or Bible group (there is exactly one doctrinal group).
 * Names are already translated by the Model API.
 */
export async function createFaqGroup(names: Record<FaqLanguage, string>, kind: FaqSectionKind): Promise<FaqGroup> {
  const { data, error } = await createAdminClient()
    .from("faq_groups")
    .insert({ kind, name_en: clean(names.en.trim()), name_es: clean(names.es.trim()), name_fr: clean(names.fr.trim()) })
    .select(FAQ_GROUP_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new FaqGroupNameTakenError(names.en);
    throw error;
  }
  return data as FaqGroup;
}

/** Remove a group that has no questions (cleanup after a failed publish). */
export async function deleteEmptyFaqGroup(id: string): Promise<void> {
  const admin = createAdminClient();
  const { count } = await admin.from("seo_cache").select("slug", { count: "exact", head: true }).eq("group_id", id);
  if (count === 0) await admin.from("faq_groups").delete().eq("id", id).neq("kind", "doctrinal");
}

/**
 * Move an FAQ (every language row of the slug) to another group. A nature
 * or Bible group left without questions is removed, as when its last FAQ is deleted.
 */
export async function moveFaqToGroup(slug: string, groupId: string): Promise<boolean> {
  const admin = createAdminClient();
  const before = await admin.from("seo_cache").select("group_id").eq("slug", slug).limit(1).maybeSingle();
  if (before.error) throw before.error;
  const { data, error } = await admin.from("seo_cache").update({ group_id: groupId }).eq("slug", slug).select("language");
  if (error) throw error;
  if (!data?.length) return false;
  const oldGroupId = (before.data?.group_id as string | null) ?? null;
  if (oldGroupId && oldGroupId !== groupId) {
    await deleteEmptyFaqGroup(oldGroupId).catch((err) => console.error("Empty group cleanup failed:", err));
  }
  revalidateTag(FAQ_LIST_CACHE_TAG, { expire: 0 });
  return true;
}

// ── Entries ─────────────────────────────────────────────────────────────

/** Insert all three language rows for a new FAQ entry, published, in a group. */
export async function publishFaq(
  slug: string,
  entries: Record<FaqLanguage, FaqEntryDraft>,
  groupId: string,
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
    group_id: groupId,
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
  const { data, error } = await admin.from("seo_cache").delete().eq("slug", slug).select("language, group_id");
  if (error) throw error;
  if (data?.length) {
    // A nature or Bible group left without questions goes too, so pickers stay clean
    // (deleteEmptyFaqGroup never removes the doctrinal group).
    const groupId = (data[0] as { group_id?: string | null }).group_id;
    if (groupId) await deleteEmptyFaqGroup(groupId).catch((err) => console.error("Empty group cleanup failed:", err));
    revalidateTag(FAQ_LIST_CACHE_TAG, { expire: 0 });
  }
  return data?.length ?? 0;
}
