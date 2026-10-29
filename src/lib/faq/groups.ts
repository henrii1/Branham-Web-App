/**
 * FAQ groups (migration 016_faq_groups.sql). Exactly one group is doctrinal
 * ("William Branham Doctrines"); every other group is a Bible group. The
 * group's kind is the faq_kind sent to the Model API when generating its
 * answers. Groups and questions keep creation order: a new question goes to
 * the end of its group.
 */

export type FaqKind = "doctrinal" | "bible";
export type FaqGroupLanguage = "en" | "es" | "fr";

export interface FaqGroup {
  id: string;
  kind: FaqKind;
  name_en: string;
  name_es: string;
  name_fr: string;
  created_at: string;
}

export const FAQ_GROUP_COLUMNS = "id, kind, name_en, name_es, name_fr, created_at" as const;
export const MAX_GROUP_NAME_CHARS = 80;
/** Admin guidance notes for an FAQ answer (Model API `faq_guidance`). */
export const MAX_GUIDANCE_CHARS = 2000;

export function groupName(group: FaqGroup, language: string): string {
  return language === "es" ? group.name_es : language === "fr" ? group.name_fr : group.name_en;
}

export interface FaqListItem {
  slug: string;
  question: string;
  group_id?: string | null;
}

export interface FaqSection<T extends FaqListItem> {
  /** Null for the fallback section (no groups table yet). */
  group: FaqGroup | null;
  items: T[];
}

/**
 * Split the (created_at-ordered) list into the page's sections: Bible groups
 * in creation order, then the doctrinal group. A question with no group, or
 * a group that no longer exists, counts as doctrinal. Empty groups are left
 * out. With no groups at all (migration not run), everything is one section.
 */
export function groupFaqItems<T extends FaqListItem>(
  items: T[],
  groups: FaqGroup[],
): { bible: FaqSection<T>[]; doctrinal: FaqSection<T> | null } {
  if (!groups.length) return { bible: [], doctrinal: items.length ? { group: null, items } : null };
  const doctrinalGroup = groups.find((g) => g.kind === "doctrinal") ?? null;
  const byId = new Map(groups.map((g) => [g.id, g]));
  const buckets = new Map<string, T[]>();
  const doctrinalItems: T[] = [];
  for (const item of items) {
    const g = item.group_id ? byId.get(item.group_id) : undefined;
    if (!g || g.kind === "doctrinal") doctrinalItems.push(item);
    else buckets.set(g.id, [...(buckets.get(g.id) ?? []), item]);
  }
  const bible = groups
    .filter((g) => g.kind === "bible")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((group) => ({ group, items: buckets.get(group.id) ?? [] }))
    .filter((s) => s.items.length > 0);
  return { bible, doctrinal: doctrinalItems.length ? { group: doctrinalGroup, items: doctrinalItems } : null };
}
