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

// ── Evidence block regex ─────────────────────────────────────────────
// Matches: "Evidence:" at the start of a line or after whitespace
const EVIDENCE_PREFIX_RE = /Evidence:/g;

/**
 * Strips letter suffixes from paragraph refs (¶10c → ¶10, ¶11a → ¶11).
 * Use before saving to DB and at render time for historical messages.
 */
export function stripParagraphLetterSuffixes(text: string): string {
  return text.replace(/¶(\d+)[a-z]?/g, "¶$1");
}

/**
 * Wraps a matched citation in a styled pill span.
 * Paragraph letter suffixes (a, b, c) are stripped for cleaner display.
 */
function makePill(innerText: string): string {
  const displayText = stripParagraphLetterSuffixes(innerText);
  return `<span class="citation-pill">[${displayText}]</span>`;
}

/**
 * Replaces "Evidence:" with a styled label chip.
 */
function makeEvidenceLabel(): string {
  return `<span class="evidence-label">Evidence</span>`;
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
  result = result.replace(EVIDENCE_PREFIX_RE, makeEvidenceLabel());

  return result;
}
