/**
 * Pure helpers for FAQ (seo_cache) entries, shared by the admin UI and the
 * admin API routes. The slug and meta rules match scripts/seed-seo.ts so
 * entries created from the app look exactly like the seeded ones.
 */

import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

export const FAQ_LANGUAGES = ["en", "es", "fr"] as const;
export type FaqLanguage = (typeof FAQ_LANGUAGES)[number];

/** One language's row, as written to seo_cache. */
export interface FaqEntryDraft {
  question: string;
  robust_query: string;
  answer_markdown: string;
  rag_context: string;
  conversation_summary: string | null;
  meta_title: string;
  meta_description: string;
}

/**
 * Postgres text columns reject NUL bytes and lone UTF-16 surrogates, and the
 * sermon passages returned by the API can contain both (the original
 * scripts/populate-faq-translations.ts stripped them for the same reason).
 */
export function sanitizeForPostgres(text: string): string {
  return text
    .replace(/\0/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

export function faqSlugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[?!.,;:'"()\[\]{}]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function faqPagePath(slug: string, language: FaqLanguage): string {
  return language === "en" ? `/q/${slug}` : `/${language}/q/${slug}`;
}

function stripMarkdownToPlain(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function faqMetaDescription(answerMarkdown: string): string {
  const plain = stripMarkdownToPlain(answerMarkdown);
  if (plain.length <= 155) return plain;
  const truncated = plain.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

export function faqMetaTitle(querySummary: string | null, question: string): string {
  return `${querySummary?.trim() || question} | Branham Sermons AI`;
}

/** Clean a raw /api/chat answer the way the seed script did before storing. */
export function cleanFaqAnswer(rawAnswer: string): string {
  return postprocessChatResponse(stripAnswerPrefix(rawAnswer));
}

export function cleanFaqRag(rawRag: string): string {
  return postprocessRag(rawRag);
}
