export const ALTAR_LANGUAGES = ["en", "es", "fr"] as const;
export type AltarLanguage = (typeof ALTAR_LANGUAGES)[number];

/** Languages devotionals are generated in today. Add "es"/"fr" here to turn them on. */
export const ALTAR_GENERATED_LANGUAGES: readonly AltarLanguage[] = ["en"];

export type AltarStatus = "pending" | "generating" | "ready" | "failed";

/** One row of family_altar_days. */
export interface FamilyAltarDay {
  day: string;
  language: AltarLanguage;
  week_start: string;
  scripture_ref: string;
  bible_version: string;
  scripture_text: string;
  title: string | null;
  reflection_markdown: string | null;
  sermon_quotes_markdown: string | null;
  discussion_questions: string[];
  prayer_intro: string | null;
  prayer_points: string[];
  sermon_references: string[];
  rag_context: string | null;
  status: AltarStatus;
  error: string | null;
  generated_at: string | null;
  edited_at: string | null;
}

/** The text fields an admin can edit. */
export interface AltarEditableFields {
  title: string;
  reflection_markdown: string;
  sermon_quotes_markdown: string;
  discussion_questions: string[];
  prayer_intro: string;
  prayer_points: string[];
  sermon_references: string[];
}

export const ALTAR_PUBLIC_COLUMNS =
  "day, language, week_start, scripture_ref, bible_version, scripture_text, title, reflection_markdown, sermon_quotes_markdown, discussion_questions, prayer_intro, prayer_points, sermon_references, rag_context, status, error, generated_at, edited_at" as const;
