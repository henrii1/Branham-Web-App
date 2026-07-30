import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  hasCitation,
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

// Cap on the fallback quote spliced in when the excerpt has no citation of
// its own — long enough to read as a real quote, short enough not to push
// the card into its smallest font tier on its own.
const MAX_FALLBACK_QUOTE_CHARS = 220;

// Matches the "### Quotes" / "## Quotes:" section heading the API emits
// (see chatPostprocess.ts's SECTION_HEADING_RE for the sibling pattern).
const QUOTES_HEADING_RE = /^#{2,3}\s+Quotes:?\s*$/im;
const NEXT_HEADING_RE = /^#{2,3}\s+\S/m;

/**
 * Pulls the first quoted excerpt out of the answer's "### Quotes" section,
 * if one exists. Each entry in that section is one or more `>` blockquote
 * lines of quoted sermon text, followed by a `>` line with an em-dash and
 * the citation (e.g. `> — [TITLE — DATE: ¶N]`). Entries are separated by a
 * blank line. Returns null if there's no Quotes section or its first entry
 * doesn't parse.
 */
function extractFirstQuote(cleaned: string): { text: string; citation: string } | null {
  const headingMatch = QUOTES_HEADING_RE.exec(cleaned);
  if (!headingMatch) return null;

  const rest = cleaned.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = NEXT_HEADING_RE.exec(rest);
  const section = nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;

  const firstEntry = section.trim().split(/\n\s*\n/)[0];
  if (!firstEntry) return null;

  const lines = firstEntry
    .split("\n")
    .map((line) => line.replace(/^>\s?/, "").trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const citationLine = lines[lines.length - 1];
  const citationMatch = /[—–-]\s*(\[[^\]]+\])/.exec(citationLine);
  if (!citationMatch) return null;

  const text = lines
    .slice(0, -1)
    .join(" ")
    .replace(/^[\u201C\u2018"]+|[\u201D\u2019"]+$/g, "")
    .trim();
  if (!text) return null;

  return { text, citation: citationMatch[1] };
}

/**
 * Builds the fallback text to splice into an excerpt that has no citation
 * of its own: the first Quotes-section entry, formatted the same way the
 * app already renders "Evidence:" elsewhere so applyCitations() picks it
 * up automatically (label chip + citation pill, no separate styling path).
 */
function buildFallbackQuoteText(cleaned: string): string | null {
  const quote = extractFirstQuote(cleaned);
  if (!quote) return null;
  const quoteText = truncateAtSentenceBoundary(quote.text, MAX_FALLBACK_QUOTE_CHARS);
  return `"${quoteText}"\n\nEvidence: ${quote.citation}`;
}

/**
 * Builds the share-card's answer excerpt: strip -> truncate -> (splice in
 * a fallback quote if truncation left no citation) -> render -> citation-
 * pill styling. Shared by every place that generates a share card
 * (ChatShell/SeoShell's conversation-share flow, SeoShell's own-page share
 * flow) so the truncation strategy can't drift between them.
 */
export function buildCardAnswerExcerpt(rawAnswer: string): string {
  const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(rawAnswer));
  const withCitation = truncateAfterFirstCitation(cleaned);
  const excerpt =
    withCitation.length <= MAX_EXCERPT_CHARS
      ? withCitation
      : truncateAtSentenceBoundary(cleaned, MAX_EXCERPT_CHARS);

  const excerptWithQuote = hasCitation(excerpt)
    ? excerpt
    : (() => {
        const fallback = buildFallbackQuoteText(cleaned);
        return fallback ? `${excerpt}\n\n${fallback}` : excerpt;
      })();

  return applyCitations(renderMarkdown(excerptWithQuote));
}
