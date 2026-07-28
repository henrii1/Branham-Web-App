import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  stripParagraphLetterSuffixes,
  truncateAfterFirstCitation,
  truncateAtSentenceBoundary,
} from "@/lib/markdown/citations";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

// Above this length, truncateAfterFirstCitation's result (which can run
// long if the first citation lands late in the answer) is replaced by a
// clean sentence-boundary truncation instead — a citation-cut excerpt is
// only shown when it's actually short enough to read as a pull-quote.
const MAX_EXCERPT_CHARS = 600;

/**
 * Builds the share-card's answer excerpt: strip -> truncate -> render ->
 * citation-pill styling. Shared by every place that generates a share
 * card (ChatShell/SeoShell's conversation-share flow, SeoShell's own-page
 * share flow) so the truncation strategy can't drift between them.
 */
export function buildCardAnswerExcerpt(rawAnswer: string): string {
  const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(rawAnswer));
  const withCitation = truncateAfterFirstCitation(cleaned);
  const excerpt =
    withCitation.length <= MAX_EXCERPT_CHARS
      ? withCitation
      : truncateAtSentenceBoundary(cleaned, MAX_EXCERPT_CHARS);
  return applyCitations(renderMarkdown(excerpt));
}
