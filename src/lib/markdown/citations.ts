/**
 * Citation detection and styling (§8 of design spec).
 *
 * Applied ONLY on the final rendered HTML in the Chat panel.
 * Not applied during streaming, and not in the Sources panel.
 *
 * Handles:
 *  1. Citation pills: [SERMON TITLE — DATE_ID: ¶X–¶Y]
 *  2. Evidence labels: "Evidence:" followed by citation pills
 */

// ── Citation pill regex ──────────────────────────────────────────────
// Matches: [TITLE — DATE_ID: ¶X–¶Y] with tolerance for dash variants.
// The DATE_ID pattern: digits-digits plus optional letter suffix (e.g., 63-1116B).
// Paragraph refs: ¶ followed by digits, optional letter suffix (e.g., ¶10c, ¶11a).
// Multiple refs separated by semicolons OR commas.
const CITATION_RE =
  /\[([^\]]+?\s[—–\-]{1,3}\s\d{2}-\d{4}[A-Z]?(?:\d)?:\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?(?:[;,]\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?)*)\]/g;

// Splits a pill into its individual sermon segments. A single bracket can
// bundle SEVERAL sermons separated by "; ", e.g.
//   [GODHEAD — 61-0425B: ¶122–¶126; Q&A — 54-0515: ¶210–¶216]
// Each segment is `<title> — <date_id>: <ranges>`. The lookahead ends a
// segment's ranges at the start of the NEXT sermon header (`; <title> — <date>:`)
// so a "; " between ranges within one sermon is NOT mistaken for a sermon break.
const SERMON_SEGMENT_RE =
  /[;\s]*(.*?)\s[—–\-]{1,3}\s(\d{2}-\d{4}[A-Z]?\d?)\s*:\s*(.*?)(?=;\s*\S.*?\s[—–\-]{1,3}\s\d{2}-\d{4}[A-Z]?\d?\s*:|$)/g;

// ── Evidence block regex ─────────────────────────────────────────────
// Matches: "Evidence:" at the start of a line or after whitespace.
// The pill opening tag is matched loosely (`citation-pill[^"]*"[^>]*`) so the
// extra class + data-* attributes added to clickable pills don't break these.
const EVIDENCE_PREFIX_RE = /(Evidence|Evidencia|Preuve):/g;
// Captures an evidence group: the label + every adjacent citation pill (whether
// separated by a space, a wrapped `;`/`,` separator span, or nothing) in group 1,
// and any trailing punctuation (`.`/`;`/`,`) that terminates the group in group 2.
// Runs AFTER the separator step so the inter-pill separators are already wrapped.
const EVIDENCE_ROW_RE =
  /(<span class="evidence-label">(?:Evidence|Evidencia|Preuve)<\/span>(?:\s|&nbsp;)*<span class="citation-pill[^"]*"[^>]*>\[[\s\S]*?<\/span>(?:(?:<span class="citation-separator">[;,]<\/span>)?\s*<span class="citation-pill[^"]*"[^>]*>\[[\s\S]*?<\/span>)*)(\s*[.;,])?/g;
// A `;` OR `,` separator between two adjacent citation pills. Both sides must be
// pills (the right side via lookahead so consecutive separators still match), so
// ordinary sentence punctuation elsewhere is never wrapped. The separator
// character is captured ($2) and preserved for desktop; mobile hides the span.
const CITATION_SEPARATOR_RE =
  /(<span class="citation-pill[^"]*"[^>]*>\[[\s\S]*?<\/span>)\s*([;,])\s*(?=<span class="citation-pill[^"]*"[^>]*>)/g;

/**
 * Strips letter suffixes from paragraph refs (¶10c → ¶10, ¶11a → ¶11).
 * Use before saving to DB and at render time for historical messages.
 */
export function stripParagraphLetterSuffixes(text: string): string {
  return text.replace(/¶(\d+)[a-z]?/g, "¶$1");
}

// Non-global sibling of CITATION_RE — used for the single first-match lookup
// truncateAfterFirstCitation needs (the `g` flag on CITATION_RE keeps
// internal .lastIndex state across calls, which .exec()-based truncation
// must avoid).
const CITATION_RE_SINGLE =
  /\[([^\]]+?\s[—–\-]{1,3}\s\d{2}-\d{4}[A-Z]?(?:\d)?:\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?(?:[;,]\s*¶\d+[a-z]?(?:[—–\-]+¶?\d+[a-z]?)?)*)\]/;

/**
 * True if `text` contains at least one citation pill match. Used by the
 * share-card excerpt builder to detect when truncation cut the text before
 * any citation appeared, so a fallback quote can be spliced in instead.
 */
export function hasCitation(text: string): boolean {
  return CITATION_RE_SINGLE.test(text);
}

/**
 * Returns the first properly-formatted citation bracket in `text` (with its
 * start index), or null. Deliberately the same strict pattern as
 * hasCitation/truncateAfterFirstCitation rather than a loose `[...]` match —
 * quoted sermon excerpts can contain other bracketed content (e.g. "[…]"
 * marking omitted words mid-quote) that a loose match would misidentify as
 * the citation.
 */
export function findFirstCitation(text: string): { match: string; index: number } | null {
  const match = CITATION_RE_SINGLE.exec(text);
  if (!match || match.index === undefined) return null;
  return { match: match[0], index: match.index };
}

/**
 * Slices `text` to end right after its first citation pill, for the
 * share-card excerpt. Returns the full text unchanged if no citation is
 * present.
 */
export function truncateAfterFirstCitation(text: string): string {
  const match = CITATION_RE_SINGLE.exec(text);
  if (!match || match.index === undefined) return text;
  return text.slice(0, match.index + match[0].length);
}

/**
 * Truncates `text` at the last sentence boundary (. ! ?) at or before
 * `maxChars`, appending "…". Falls back to a hard cut at `maxChars` if no
 * sentence boundary exists in range. Used for the share-card excerpt when
 * `truncateAfterFirstCitation`'s result is too long to fit the card —
 * ending mid-word/mid-citation reads as broken, ending at a sentence
 * boundary reads as an intentional pull-quote.
 */
export function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (lastBoundary > maxChars * 0.4) {
    return `${window.slice(0, lastBoundary + 1)}…`;
  }
  // No good sentence boundary found — hard cut at the last whole word.
  const lastSpace = window.lastIndexOf(" ");
  return `${window.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

// ── Reference parsing (for the clickable tooltip) ────────────────────
// A pill's inner text is the only source of truth: `TITLE — DATE_ID: <ranges>`.
// We parse it into the shape the /api/reference endpoint expects so a click
// can round-trip the exact cited paragraph ranges (±1 context is added server
// side). Bible references never match CITATION_RE, so they never become pills.

export interface CitationRange {
  paragraph_start: number;
  paragraph_end?: number;
}

export interface CitationEntry {
  date_id: string;
  title: string;
  ranges: CitationRange[];
}

/** HTML-attribute escaping so titles/JSON embed safely in data-* attributes. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Splits the paragraph-range portion of a pill (`¶57–¶61, ¶85–¶89` or `¶240`)
 * into the endpoint's `ranges` array. `¶` and any letter suffix are dropped —
 * only the digits matter (`¶386a` → 386).
 */
function parseRanges(rangePart: string): CitationRange[] {
  const ranges: CitationRange[] = [];
  for (const item of rangePart.split(/[;,]/)) {
    const nums = item.match(/\d+/g);
    if (!nums || nums.length === 0) continue;
    const range: CitationRange = { paragraph_start: parseInt(nums[0], 10) };
    if (nums.length > 1) range.paragraph_end = parseInt(nums[1], 10);
    ranges.push(range);
  }
  return ranges;
}

/**
 * Parses a pill's inner text into one entry per cited sermon, each with its own
 * title, date_id, and paragraph ranges. Returns an empty array when nothing
 * resolves (in which case the pill stays non-clickable, as before).
 */
function parseCitationReferences(innerText: string): CitationEntry[] {
  const refs: CitationEntry[] = [];
  SERMON_SEGMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SERMON_SEGMENT_RE.exec(innerText)) !== null) {
    // Defensive guard against a zero-length match looping forever.
    if (match[0].length === 0) {
      SERMON_SEGMENT_RE.lastIndex += 1;
      continue;
    }
    const title = match[1].trim().replace(/[\s—–\-]+$/, "").trim();
    const dateId = match[2];
    const ranges = parseRanges(match[3]);
    if (ranges.length === 0) continue;
    refs.push({ date_id: dateId, title, ranges });
  }
  return refs;
}

/** Formats a sermon's parsed ranges back to display text (`¶57–¶61, ¶85–¶89`). */
function formatRanges(ranges: CitationRange[]): string {
  return ranges
    .map((r) =>
      r.paragraph_end && r.paragraph_end !== r.paragraph_start
        ? `¶${r.paragraph_start}–¶${r.paragraph_end}`
        : `¶${r.paragraph_start}`,
    )
    .join(", ");
}

/**
 * Builds one clickable pill for a single sermon reference. Each pill is its own
 * box ([TITLE — DATE_ID: ranges]) and opens a tooltip showing only that sermon —
 * so a bracket that cites several sermons becomes several separate pills. The
 * sermon's data is embedded as a single-element `data-references` JSON payload.
 */
function makeSinglePill(ref: CitationEntry): string {
  // ref.title comes from already-HTML-escaped source (applyCitations runs on
  // rendered HTML), so it's safe to interpolate into both contexts as-is.
  const displayText = `${ref.title} — ${ref.date_id}: ${formatRanges(ref.ranges)}`;
  const payload = escapeHtmlAttr(JSON.stringify([ref]));
  return (
    `<span class="citation-pill citation-pill--clickable" role="button" tabindex="0"` +
    ` data-references="${payload}">[${displayText}]</span>`
  );
}

/**
 * Wraps a matched citation in styled pill span(s).
 * Paragraph letter suffixes (a, b, c) are stripped for cleaner display.
 *
 * A bracket may cite several sermons separated by "; ". Each sermon is rendered
 * as its OWN clickable pill (separate box) so a tooltip only ever shows a single
 * sermon's excerpts. The "; " was only an internal split cue — the pills are
 * re-joined with a plain space so no separator punctuation shows between the
 * boxes. A bracket that doesn't parse into any resolvable reference stays a
 * single non-clickable pill.
 */
function makePill(innerText: string): string {
  const refs = parseCitationReferences(innerText);

  if (refs.length === 0) {
    const displayText = stripParagraphLetterSuffixes(innerText);
    return `<span class="citation-pill">[${displayText}]</span>`;
  }

  return refs.map(makeSinglePill).join(" ");
}

/**
 * Replaces "Evidence:" with a styled label chip.
 */
function makeEvidenceLabel(word: string): string {
  return `<span class="evidence-label">${word}</span>`;
}

/**
 * Applies citation pill styling and Evidence label styling to final HTML.
 * Call this ONLY on the fully rendered (post-markdown) HTML of assistant
 * messages in the Chat panel.
 */
export function applyCitations(html: string): string {
  if (!html) return html;

  // Step 1: Replace citation brackets with styled pills
  let result = html.replace(CITATION_RE, (_match, inner) => makePill(inner));

  // Step 2: Replace "Evidence:" text with styled label
  result = result.replace(EVIDENCE_PREFIX_RE, (_match, word: string) => makeEvidenceLabel(word));

  // Step 3: Wrap `;`/`,` separators between adjacent citation pills so mobile
  // can hide the punctuation while desktop keeps the original character.
  result = result.replace(
    CITATION_SEPARATOR_RE,
    '$1<span class="citation-separator">$2</span> ',
  );

  // Step 4: Wrap evidence groups so mobile can move them onto their own line,
  // and wrap any trailing punctuation (the full stop after the citations) so
  // mobile can drop it — on a stacked layout a lone trailing "." reads as an
  // orphaned line. Desktop keeps both the separators and the trailing stop.
  result = result.replace(EVIDENCE_ROW_RE, (_match, body, trailing) =>
    trailing
      ? `<span class="evidence-row">${body}<span class="evidence-trailing">${trailing}</span></span>`
      : `<span class="evidence-row">${body}</span>`,
  );

  return result;
}

/**
 * Scans `html` for every citation bracket, in document order, expanding a
 * multi-sermon bracket into one entry per sermon — the same expansion
 * makePill already does for inline pills. No awareness of "sections": a
 * citation counts wherever it appears (inline, Quotes section, References
 * section). Call this on renderMarkdown() output, NOT raw markdown — title
 * text must already be HTML-entity-escaped, matching makeSinglePill's
 * existing escaping assumption (see its docstring above).
 */
export function extractOrderedCitations(html: string): CitationEntry[] {
  const entries: CitationEntry[] = [];
  const re = new RegExp(CITATION_RE.source, CITATION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    entries.push(...parseCitationReferences(match[1]));
  }
  return entries;
}

function citationKey(entry: CitationEntry): string {
  const ranges = entry.ranges
    .map((r) => `${r.paragraph_start}-${r.paragraph_end ?? ""}`)
    .join(",");
  return `${entry.date_id}|${ranges}`;
}

/**
 * Keeps the first occurrence of each exact citation (same date_id AND same
 * paragraph range) and drops later duplicates. Two citations of the same
 * sermon with different ranges are NOT duplicates of each other.
 */
export function dedupeCitations(entries: CitationEntry[]): CitationEntry[] {
  const seen = new Set<string>();
  const result: CitationEntry[] = [];
  for (const entry of entries) {
    const key = citationKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/**
 * Renders a deduped, ordered citation list as one clickable pill per row —
 * used by the chat window's "Sermon Quotes" view. Reuses the single-pill
 * builder, so each row carries the same .citation-pill--clickable class and
 * data-references JSON payload ReferencePopover's delegated click listener
 * already handles — no new click-handling code needed.
 */
export function renderCitationList(entries: CitationEntry[]): string {
  return entries
    .map((entry) => `<div class="raw-reference-row">${makeSinglePill(entry)}</div>`)
    .join("");
}
