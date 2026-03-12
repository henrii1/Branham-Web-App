/**
 * RAG context postprocessing — cleans up raw retrieval text before
 * markdown rendering in the Sources panel.
 *
 * Removes:
 *  1. Inline sermon titles (ALL CAPS) that bleed into chunk text
 *     from the original PDF layout. Keeps the section headers intact.
 *  2. Sermon start marker (U+F6E1 / ) when it prefixes the first paragraph.
 *  3. "THE SPOKEN WORD" if present in all caps.
 *  4. Sermon end metadata: from date_id (61-0212M) or section marker (U+F6E1) to end of line.
 *     E.g., "...Brother Buntain. 61-0212M Jehovah-Jireh First Assembly..."
 *  5. Sermon boilerplate (copyright notices, VGR info, location blocks).
 *
 * Apply before saving to DB and during render for historic data.
 */

// ── Section header regex ─────────────────────────────────────────────
// Matches: ### N. SERMON TITLE — DATE_ID
// Also tolerates non-markdown numbered headers from older/raw RAG payloads.
// Captures group 1 = sermon title (everything between "N. " and " — ")
const SECTION_HEADER_RE =
  /^(?:###\s+)?\d+\.\s+(.+?)\s+[—–-]{1,3}\s+\d{4}-\d{2}-\d{2}/gm;

// ── Boilerplate patterns ─────────────────────────────────────────────
// Matches sermon location/copyright blocks that leak into chunk context.
// The block typically starts with a date_id line (e.g., "57-0915E Title")
// and runs through "www.branham.org" / copyright / VGR lines.
const BOILERPLATE_MARKERS = [
  /V\s*OICE\s+OF\s+GOD\s+RECORD(?:ING)?S?/i,
  /P\.?\s*O\.?\s*BOX\s+950/i,
  /www\.branham\.org/i,
  /Copyright\s+Notice/i,
  /©\s*\d{4}\s+VGR/i,
  /ALL\s+RIGHTS\s+RESERVED/i,
  /\(812\)\s*256-1177/i,
];

// Date ID at start of line: e.g., "57-0915E" or "64-0830M"
const DATE_ID_LINE_RE = /^\d{2}-\d{4}[A-Z]?\s+/;

// ── THE SPOKEN WORD dedup ────────────────────────────────────────────
const SPOKEN_WORD_RE = /THE\s+SPOKEN\s+WORD/g;

// ── Sermon start marker (U+F6E1 / ) ────────────────────────────────
// Removes the marker when it prefixes the opening sermon paragraph.
// Examples:
//   "¶1–¶2 Thank you, Brother Neville."  -> "¶1–¶2 Thank you, Brother Neville."
//   "Good evening, friends."             -> "Good evening, friends."
const SERMON_START_INLINE_MARKER_RE =
  /(^|\n)(\s*(?:-\s*)?¶\d+[a-z]?(?:[—–-]+¶?\d+[a-z]?)?\s+)\uF6E1\s*/gimu;
const SERMON_START_LINE_MARKER_RE =
  /(^|\n)(\s*)\uF6E1\s*(?=\S)/gimu;

function removeSermonStartMarkers(text: string): string {
  let result = text.replace(
    SERMON_START_INLINE_MARKER_RE,
    (_match, lineStart: string, paragraphPrefix: string) =>
      `${lineStart}${paragraphPrefix}`,
  );
  result = result.replace(
    SERMON_START_LINE_MARKER_RE,
    (_match, lineStart: string, indentation: string) =>
      `${lineStart}${indentation}`,
  );
  return result;
}

// ── Sermon end metadata ──────────────────────────────────────────────
// Inline date_id followed by sermon title + location at end of a chunk.
// E.g., "...Brother Buntain. 61-0212M Jehovah-Jireh First Assembly..."
// Matches WITHIN a line only (uses [ \t]+ not \s+ to avoid eating newlines).
// Requires uppercase letter after date (sermon title), which excludes citations
// like "[SERMON — 61-0212M: ¶165]" where the date is followed by ": ¶".
const SERMON_END_INLINE_RE = /[ \t]+\d{2}-\d{4}[A-Z]?[ \t]+[A-Z][^\n]*/g;

// Date_id at the start of its own line (standalone boilerplate line).
// E.g., "61-0212M Jehovah-Jireh First Assembly Of God..."
const SERMON_END_LINE_RE = /^\d{2}-\d{4}[A-Z]?\s+[A-Z][^\n]*/gm;

// Section marker (U+F6E1) — alternative sermon-end indicator, within a line only
const SERMON_END_MARKER_RE = /[ \t]+[\uF6E1][^\n]*/g;

/**
 * Removes sermon end metadata that bleeds into chunk text.
 * Handles both inline occurrences and standalone boilerplate lines.
 */
function removeSermonEndMetadata(text: string): string {
  let result = text;
  // Remove inline metadata (within a line, preceded by spaces/tabs)
  result = result.replace(SERMON_END_INLINE_RE, "");
  // Remove standalone metadata lines (date_id at start of line)
  result = result.replace(SERMON_END_LINE_RE, "");
  // Remove section marker metadata
  result = result.replace(SERMON_END_MARKER_RE, "");
  return result;
}

/**
 * Escapes a string for use inside a RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts sermon titles from section headers in the RAG context.
 * Returns an array of titles (ALL CAPS strings).
 */
function extractSermonTitles(text: string): string[] {
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  SECTION_HEADER_RE.lastIndex = 0;
  while ((match = SECTION_HEADER_RE.exec(text)) !== null) {
    titles.push(match[1].trim());
  }
  return titles;
}

/**
 * Removes inline sermon titles from chunk body text.
 * The title may be followed by an optional page number (1-3 digits).
 * Only removes from non-header lines (lines not starting with #).
 */
function removeInlineTitles(text: string, titles: string[]): string {
  if (titles.length === 0) return text;

  let result = text;
  for (const title of titles) {
    // Remove exact inline title matches, optionally followed by a page number.
    const exactPattern = new RegExp(
      `${escapeRegex(title)}(?:\\s+\\d{1,3})?`,
      "gm",
    );
    result = result.replace(exactPattern, (match, offset) => {
      const lineStart = result.lastIndexOf("\n", offset) + 1;
      const linePrefix = result.slice(lineStart, offset);
      if (linePrefix.trimStart().startsWith("#")) return match;
      return "";
    });

    // Some PDF extractions truncate the repeated inline title with an ellipsis:
    // "THE BREACH BETWEEN THE SEVEN CHURCH AGES AND THE…"
    // Build safe prefix variants from the real title and remove them only when
    // they end with an ellipsis, which greatly reduces false positives.
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length >= 4) {
      for (let wordCount = words.length - 1; wordCount >= 4; wordCount--) {
        const prefix = words.slice(0, wordCount).join(" ");
        const truncatedPattern = new RegExp(
          `${escapeRegex(prefix)}(?:…|\\.\\.\\.)`,
          "gm",
        );
        result = result.replace(truncatedPattern, (match, offset) => {
          const lineStart = result.lastIndexOf("\n", offset) + 1;
          const linePrefix = result.slice(lineStart, offset);
          if (linePrefix.trimStart().startsWith("#")) return match;
          return "";
        });
      }
    }
  }

  // Clean up double spaces left by removal
  result = result.replace(/  +/g, " ");
  return result;
}

/**
 * Removes sermon boilerplate blocks (location, copyright, VGR info).
 *
 * Strategy: scan lines for boilerplate markers. When found, expand
 * upward to the nearest date_id line and remove the entire block.
 */
function removeBoilerplate(text: string): string {
  const lines = text.split("\n");
  const linesToRemove = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMarker = BOILERPLATE_MARKERS.some((re) => re.test(line));
    if (!isMarker) continue;

    // Mark this line for removal
    linesToRemove.add(i);

    // Expand upward to find the date_id line (or stop at a header / empty stretch)
    for (let j = i - 1; j >= 0 && j >= i - 15; j--) {
      const above = lines[j].trim();
      if (above === "" || above.startsWith("#")) break;
      linesToRemove.add(j);
      if (DATE_ID_LINE_RE.test(above)) break;
    }

    // Expand downward through remaining boilerplate lines
    for (let j = i + 1; j < lines.length && j <= i + 20; j++) {
      const below = lines[j].trim();
      // Stop at empty line followed by non-boilerplate, or at a header
      if (below.startsWith("#")) break;
      if (below === "") {
        // Check if next non-empty line is still boilerplate
        const nextNonEmpty = lines.slice(j + 1).find((l) => l.trim() !== "");
        if (
          nextNonEmpty &&
          BOILERPLATE_MARKERS.some((re) => re.test(nextNonEmpty))
        ) {
          linesToRemove.add(j);
          continue;
        }
        break;
      }
      // Check if this line is also a boilerplate marker or related context
      const isRelated =
        BOILERPLATE_MARKERS.some((re) => re.test(below)) ||
        /^ENGLISH$/i.test(below) ||
        /^Jeffersonville/i.test(below) ||
        /^Branham\s+Tabernacle/i.test(below) ||
        /^\w+\s+(Tabernacle|U\.S\.A\.|Indiana)/i.test(below) ||
        /^For more information/i.test(below) ||
        /^All rights reserved/i.test(below) ||
        /^This book may be/i.test(below) ||
        /^personal use or/i.test(below) ||
        /^the Gospel of/i.test(below) ||
        /^large scale/i.test(below) ||
        /^into other languages/i.test(below) ||
        /^written permission/i.test(below) ||
        DATE_ID_LINE_RE.test(below);
      if (isRelated) {
        linesToRemove.add(j);
      } else {
        break;
      }
    }
  }

  if (linesToRemove.size === 0) return text;

  return lines.filter((_, i) => !linesToRemove.has(i)).join("\n");
}

/**
 * Full RAG context postprocessing pipeline.
 * Call this on the raw rag_context string before markdown rendering.
 */
export function postprocessRag(ragContext: string): string {
  if (!ragContext) return ragContext;

  let result = ragContext;

  // 1. Extract sermon titles from headers before any modifications
  const titles = extractSermonTitles(result);

  // 2. Remove inline sermon titles from chunk text
  result = removeInlineTitles(result, titles);

  // 3. Remove sermon start markers () when they prefix the opening paragraph
  result = removeSermonStartMarkers(result);

  // 4. Remove "THE SPOKEN WORD" occurrences
  result = result.replace(SPOKEN_WORD_RE, "");

  // 5. Remove sermon end metadata (date_id + title + location at end of chunks)
  result = removeSermonEndMetadata(result);

  // 6. Remove sermon boilerplate (copyright, VGR, location blocks)
  result = removeBoilerplate(result);

  // 7. Collapse 3+ consecutive blank lines to 2
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
