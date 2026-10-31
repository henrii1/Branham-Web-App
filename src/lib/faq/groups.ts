/**
 * FAQ groups (migrations 016_faq_groups.sql, 017_faq_nature_kind.sql). Three
 * kinds, each a section of the FAQ page:
 * - "nature" (Christianity Seen in Nature, first): God shown from nature and
 *   natural principles, no Bible quotes; written by the admins only.
 * - "bible" (Bible questions): Scripture-first answers.
 * - "doctrinal" (Doctrinal Truths, last): exactly one group.
 * The kind is the faq_kind sent to the Model API. Follow-ups on bible and
 * nature pages are answered from Scripture (followup_kind "bible").
 * Groups and questions keep creation order: a new question goes to the end
 * of its group.
 */

export type FaqKind = "doctrinal" | "bible" | "nature";
/** Kinds that have several named groups (the doctrinal kind has one). */
export type FaqSectionKind = "nature" | "bible";
/** A chat started from a FAQ of this kind is answered from Scripture. */
export type FollowupFaqKind = "bible" | "nature";

export function isFollowupFaqKind(kind: string | null | undefined): kind is FollowupFaqKind {
  return kind === "bible" || kind === "nature";
}

/**
 * Under the chat box for follow-ups on a nature FAQ: its answer quoted no
 * Scripture, the follow-up answers will.
 */
export const NATURE_FOLLOWUP_NOTE: Record<FaqGroupLanguage, string> = {
  en: "The first answer reasons from nature alone. Follow-up answers are drawn from biblical truths and quote Scripture.",
  es: "La primera respuesta razona solo a partir de la naturaleza. Las respuestas de seguimiento se basan en verdades bíblicas y citan las Escrituras.",
  fr: "La première réponse raisonne à partir de la nature seule. Les réponses de suivi s’appuient sur les vérités bibliques et citent les Écritures.",
};

export function natureFollowupNote(language: string | null | undefined): string {
  return NATURE_FOLLOWUP_NOTE[language === "es" || language === "fr" ? language : "en"];
}

export const SECTION_LABELS: Record<FaqKind, Record<FaqGroupLanguage, string>> = {
  nature: { en: "Christianity Seen in Nature", es: "El cristianismo visto en la naturaleza", fr: "Le christianisme vu dans la nature" },
  bible: { en: "Bible questions", es: "Preguntas bíblicas", fr: "Questions bibliques" },
  doctrinal: { en: "Doctrinal Truths", es: "Verdades doctrinales", fr: "Vérités doctrinales" },
};
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

export interface FaqSections<T extends FaqListItem> {
  nature: FaqSection<T>[];
  bible: FaqSection<T>[];
  doctrinal: FaqSection<T> | null;
}

/**
 * Split the (created_at-ordered) list into the page's sections: nature and
 * Bible groups, each in creation order, then the doctrinal group. A question
 * with no group, or a group that no longer exists, counts as doctrinal.
 * Empty groups are left out. With no groups at all (migration not run),
 * everything is one section.
 */
export function groupFaqItems<T extends FaqListItem>(items: T[], groups: FaqGroup[]): FaqSections<T> {
  if (!groups.length) return { nature: [], bible: [], doctrinal: items.length ? { group: null, items } : null };
  const doctrinalGroup = groups.find((g) => g.kind === "doctrinal") ?? null;
  const byId = new Map(groups.map((g) => [g.id, g]));
  const buckets = new Map<string, T[]>();
  const doctrinalItems: T[] = [];
  for (const item of items) {
    const g = item.group_id ? byId.get(item.group_id) : undefined;
    if (!g || g.kind === "doctrinal") doctrinalItems.push(item);
    else buckets.set(g.id, [...(buckets.get(g.id) ?? []), item]);
  }
  const sectionOf = (kind: FaqSectionKind) =>
    groups
      .filter((g) => g.kind === kind)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((group) => ({ group, items: buckets.get(group.id) ?? [] }))
      .filter((s) => s.items.length > 0);
  return {
    nature: sectionOf("nature"),
    bible: sectionOf("bible"),
    doctrinal: doctrinalItems.length ? { group: doctrinalGroup, items: doctrinalItems } : null,
  };
}
