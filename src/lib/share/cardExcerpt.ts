import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  findFirstCitation,
  hasCitation,
  stripParagraphLetterSuffixes,
  truncateAfterFirstCitation,
  truncateAtSentenceBoundary,
} from "@/lib/markdown/citations";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

// Raised from 600: real SEO-cached answers can run 700-800+ chars before
// their first inline citation (checked a 34-page sample of published /q
// answers — citations landed anywhere from 225 to 789 chars in). 900
// covers that range with margin, so truncateAfterFirstCitation's natural
// result is usable more often and the Quotes/References fallback below is
// only needed for genuine outliers beyond this budget.
const MAX_EXCERPT_CHARS = 900;

// Cap on the fallback quote spliced in when the excerpt has no citation of
// its own — long enough to read as a real quote, short enough not to push
// the card into its smallest font tier on its own.
const MAX_FALLBACK_QUOTE_CHARS = 220;

// Section-heading names the API emits vary per language (checked real
// published answers in all three supported languages):
//   en: "Quotes" / "References"
//   es: "Citas" / "Referencias"
//   fr: "Citations" / "Références" (note the space before the colon:
//       "### Citations :" — the trailing `\s*:?\s*$` below covers that)
// EXTENDING TO A NEW LANGUAGE: add that language's translations to both
// alternations below. See chatPostprocess.ts's SECTION_HEADING_RE for the
// sibling concern on the live chat panel's own section dividers.
const QUOTES_HEADING_RE = /^#{2,3}\s+(?:Quotes|Citas|Citations)\s*:?\s*$/im;
const REFERENCES_HEADING_RE = /^#{2,3}\s+(?:References|Referencias|Références)\s*:?\s*$/im;
const NEXT_HEADING_RE = /^#{2,3}\s+\S/m;

// Some Quotes-section entries cite the source in parentheses instead of
// square brackets — confirmed in real ES/FR content, e.g.
// "(LA CRUELDAD DEL PECADO... — 53-0403: ¶97)" — while every other
// citation surface in the app (citation pills, References-section
// entries) uses square brackets exclusively. Requires the same strict
// inner structure as findFirstCitation (TITLE — DATE_ID: ¶refs) so a
// stray parenthetical aside in the quote's own prose is never mistaken
// for one.
const PAREN_CITATION_RE =
  /\(([^()]+?\s[—–-]{1,3}\s\d{2}-\d{4}[A-Z]?\d?:\s*¶\d+[a-z]?(?:[—–-]+¶?\d+[a-z]?)?(?:[;,]\s*¶\d+[a-z]?(?:[—–-]+¶?\d+[a-z]?)?)*)\)/;

/**
 * Finds the first citation in `text`, accepting either the standard
 * square-bracket form or the parenthesized form some Quotes entries use.
 * A parenthesized match is normalized to `[...]` so it renders identically
 * (as a styled citation pill) once spliced through applyCitations() —
 * which only recognizes the bracket form.
 */
function findQuoteCitation(text: string): { match: string; index: number } | null {
  const bracket = findFirstCitation(text);
  const paren = PAREN_CITATION_RE.exec(text);
  if (bracket && (!paren || bracket.index <= paren.index)) return bracket;
  if (paren && paren.index !== undefined) {
    return { match: `[${paren[1]}]`, index: paren.index };
  }
  return null;
}

function extractSectionBody(cleaned: string, headingRe: RegExp): string | null {
  const headingMatch = headingRe.exec(cleaned);
  if (!headingMatch) return null;
  const rest = cleaned.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = NEXT_HEADING_RE.exec(rest);
  return nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;
}

/**
 * Pulls the first quoted excerpt out of the answer's Quotes section, if one
 * exists. Each entry is one or more `>` blockquote lines, entries separated
 * by a blank line. The citation bracket can land in any of three shapes
 * seen in real API output — inline at the end of the quote's own line, on
 * its own trailing `>` line after an em-dash, or on its own trailing `>`
 * line with no em-dash — so this doesn't assume a fixed line count: it
 * joins the entry's lines and takes the first citation found anywhere in
 * it, treating everything before that as the quote text. Uses the strict
 * citation matcher (not a loose `[...]` bracket match) because a quoted
 * sermon excerpt can itself contain other bracketed content — e.g. "[…]"
 * marking words omitted mid-quote — that a loose match would misidentify
 * as the citation. Also accepts the parenthesized citation form some
 * entries use instead of brackets (see findQuoteCitation).
 */
function extractFirstQuote(cleaned: string): { text: string; citation: string } | null {
  const section = extractSectionBody(cleaned, QUOTES_HEADING_RE);
  if (!section) return null;

  const firstEntry = section.trim().split(/\n\s*\n/)[0];
  if (!firstEntry) return null;

  const joined = firstEntry
    .split("\n")
    .map((line) => line.replace(/^>\s?/, "").trim())
    .filter(Boolean)
    .join(" ");

  const citationMatch = findQuoteCitation(joined);
  if (!citationMatch) return null;

  const text = joined
    .slice(0, citationMatch.index)
    .replace(/[—–-]\s*$/, "") // drop a trailing em/en-dash separator, if present
    .replace(/^[“‘"]+|[”’"]+$/g, "")
    .trim();
  if (!text) return null;

  return { text, citation: citationMatch.match };
}

/**
 * Pulls the first bare citation out of the answer's References section —
 * no quote text, just the reference itself. Last-resort fallback so every
 * card can guarantee a reference even when there's no Quotes section, or
 * its first entry didn't parse.
 */
function extractFirstReference(cleaned: string): string | null {
  const section = extractSectionBody(cleaned, REFERENCES_HEADING_RE);
  if (!section) return null;
  const citationMatch = findFirstCitation(section);
  return citationMatch ? citationMatch.match : null;
}

/**
 * Builds the fallback text to splice into an excerpt that has no citation
 * of its own: first choice is the first Quotes-section entry (quote text +
 * citation); if that's unavailable, falls back to a bare citation pulled
 * from the References section — every answer that has evidence at all has
 * a References section, so this is the harder-to-defeat guarantee. Both
 * shapes are formatted the same way the app already renders "Evidence:"
 * elsewhere so applyCitations() picks them up automatically (label chip +
 * citation pill, no separate styling path).
 */
function buildFallbackEvidenceText(cleaned: string): string | null {
  const quote = extractFirstQuote(cleaned);
  if (quote) {
    const quoteText = truncateAtSentenceBoundary(quote.text, MAX_FALLBACK_QUOTE_CHARS);
    return `"${quoteText}"\n\nEvidence: ${quote.citation}`;
  }
  const reference = extractFirstReference(cleaned);
  return reference ? `Evidence: ${reference}` : null;
}

/**
 * Truncates at the last paragraph break (blank line) at or before
 * maxChars, if one falls reasonably within budget; otherwise falls back to
 * truncateAtSentenceBoundary. A whole extra paragraph of context reads
 * better on a card than a mid-thought stop, but only when finding one
 * doesn't mean giving up most of the budget to reach it.
 */
function truncateAtParagraphOrSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars);
  const lastParagraphBreak = window.lastIndexOf("\n\n");
  if (lastParagraphBreak > maxChars * 0.4) {
    return window.slice(0, lastParagraphBreak).trimEnd();
  }
  return truncateAtSentenceBoundary(text, maxChars);
}

/**
 * Strip -> truncate (preferring a paragraph boundary, then a sentence
 * boundary) -> splice in a fallback reference if truncation left no
 * citation. Every excerpt is guaranteed at least one reference: either its
 * own inline citation survives truncation, or the Quotes/References
 * fallback supplies one. Shared by both consumers below so the truncation
 * strategy can't drift between the downloadable card and the Open Graph
 * preview image.
 */
function buildExcerptWithEvidence(rawAnswer: string): string {
  const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(rawAnswer));
  const withCitation = truncateAfterFirstCitation(cleaned);
  const excerpt =
    withCitation.length <= MAX_EXCERPT_CHARS
      ? withCitation
      : truncateAtParagraphOrSentenceBoundary(cleaned, MAX_EXCERPT_CHARS);

  return hasCitation(excerpt)
    ? excerpt
    : (() => {
        const fallback = buildFallbackEvidenceText(cleaned);
        return fallback ? `${excerpt}\n\n${fallback}` : excerpt;
      })();
}

/**
 * Builds the share-card's answer excerpt: buildExcerptWithEvidence's plain
 * text, rendered -> citation-pill styling. Shared by every place that
 * generates a *downloadable/rasterized* share card (ChatShell/SeoShell's
 * conversation-share flow, SeoShell's own-page share flow) so the
 * truncation strategy can't drift between them.
 */
export function buildCardAnswerExcerpt(rawAnswer: string): string {
  return applyCitations(renderMarkdown(buildExcerptWithEvidence(rawAnswer)));
}

/**
 * Plain-text variant for the Open Graph preview image (next/og's
 * ImageResponse, Satori-rendered) — it can't render our citation-pill HTML
 * (dangerouslySetInnerHTML/arbitrary DOM isn't supported there), so this
 * strips markdown syntax instead of styling it, and collapses paragraph
 * breaks into one flowing line since the preview is a small thumbnail, not
 * a multi-paragraph layout. Citation brackets (`[TITLE — DATE: ¶N]`) are
 * left as plain visible text — they read fine unstyled at this size.
 */
export function buildOgExcerptText(rawAnswer: string): string {
  return buildExcerptWithEvidence(rawAnswer)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}
