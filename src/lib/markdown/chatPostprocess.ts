/**
 * Chat response postprocessing — formats the assistant response
 * markdown before rendering in the Chat panel.
 *
 * 0. Inline-bold Reader Note → label-only bold:
 *    **Reader Note: body** → **Reader Note:** body
 * 1. Adds horizontal rule (---) dividers above distinct sections:
 *    - Quotes, References, Reader Note headings
 * 2. Downsizes Reader Note heading from ### to ##### (two levels smaller).
 *    Only "Reader Note" stays capitalized; trailing text is sentence-cased.
 *    #### or ##### Reader Note headings are left as-is.
 * 3. Strips bold markers from the Reader Note section body — only the
 *    "Reader Note:" label itself remains bold; body text is plain.
 */

// Matches Quotes, References, and Unverified/External Information section headings (## or ###).
const SECTION_HEADING_RE =
  /^(#{2,3}\s+(?:Quotes|References|Unverified\s*\/?\s*External\s+Information)[s]?[:\s]?.*)/gim;

// Matches Reader Note heading. Captures: (1) hashes, (2) "Reader Note", (3) rest of line.
const READER_NOTE_RE =
  /^(#{2,3})\s+(Reader\s*Note)[:\s]?(.*)/gim;

/**
 * Converts a string to sentence case (first letter uppercase, rest lowercase).
 */
function toSentenceCase(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Returns true if the text just before `offset` already has a --- rule.
 */
function hasRuleAbove(text: string, offset: number): boolean {
  const before = text.slice(Math.max(0, offset - 10), offset);
  return /---\s*$/.test(before);
}

/**
 * Formats the assistant response markdown before rendering.
 * Idempotent — safe to apply multiple times.
 */
export function postprocessChatResponse(text: string): string {
  if (!text) return text;

  let result = text;

  // Step 0: Inline-bold Reader Note — the API sometimes returns the entire
  // note as **Reader Note: body text** (all bold).
  // Convert to **Reader Note:** body text (label-only bold, body is plain).
  // Idempotent: **Reader Note:** with no trailing ** won't match.
  result = result.replace(
    /\*\*Reader\s+Note:\s*([\s\S]+?)\*\*(?!\*)/g,
    (_, body: string) => `**Reader Note:** ${body.trimEnd()}`,
  );

  // Step 1: Downsize Reader Note headings (### → #####) and sentence-case trailing text.
  // Only downsizes ## and ###; leaves #### and ##### as-is.
  result = result.replace(
    READER_NOTE_RE,
    (_match, hashes: string, label: string, rest: string, offset: number) => {
      const level = hashes.length;
      // Only downsize ## (h2) and ### (h3) — two levels smaller
      const newHashes = level <= 3 ? "#####" : hashes;
      const formattedRest = rest ? ` ${toSentenceCase(rest)}` : "";
      // Only "Reader Note:" is bolded; trailing text is plain
      const heading = `${newHashes} **Reader Note:**${formattedRest}`;

      if (hasRuleAbove(result, offset)) return heading;
      return `---\n${heading}`;
    },
  );

  // Step 2: Normalize ## Unverified/External Information → ### so it matches Quotes/References level.
  result = result.replace(
    /^##(\s+(?:Unverified\s*\/?\s*External\s+Information))/gim,
    "###$1",
  );

  // Step 3: Add --- above Quotes, References, and Unverified/External Information headings.
  result = result.replace(
    SECTION_HEADING_RE,
    (match, heading, offset) => {
      if (hasRuleAbove(result, offset)) return heading;
      return `---\n${heading}`;
    },
  );

  // Step 4: Strip bold markers from Reader Note section body.
  // Walk through the text and de-bold everything after a Reader Note heading
  // until the next --- divider, any heading (##…), or end of string.
  // The heading line itself is left untouched so **Reader Note:** stays bold.
  {
    const headingRe = /(?:^|\n)(#{3,5}\s+\*\*Reader Note:\*\*[^\n]*\n)/g;
    let match: RegExpExecArray | null;
    const parts: string[] = [];
    let cursor = 0;

    while ((match = headingRe.exec(result)) !== null) {
      const headingStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
      const headingEnd = headingStart + match[1].length;

      // Everything before this heading — copy verbatim.
      parts.push(result.slice(cursor, headingEnd));

      // Body: from end of heading line until the next --- or ## heading or EOS.
      const bodyStart = headingEnd;
      const nextSectionRe = /\n(?=---|#{2,}\s)/g;
      nextSectionRe.lastIndex = bodyStart;
      const nextMatch = nextSectionRe.exec(result);
      const bodyEnd = nextMatch ? nextMatch.index : result.length;

      const body = result.slice(bodyStart, bodyEnd);
      // Strip ** and __ bold markers from the body only.
      parts.push(body.replace(/\*\*([\s\S]+?)\*\*/g, "$1").replace(/__([\s\S]+?)__/g, "$1"));

      cursor = bodyEnd;
      headingRe.lastIndex = bodyEnd;
    }

    parts.push(result.slice(cursor));
    result = parts.join("");
  }

  return result;
}
