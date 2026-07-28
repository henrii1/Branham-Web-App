/**
 * Passage n-gram highlighting — literal query/passage word overlap in the
 * Sources panel (chat + SEO pages). Post-processes already-rendered HTML
 * the same way citations.ts styles the chat answer panel: as a regex-based
 * pass over HTML our own renderMarkdown produced (never arbitrary external
 * HTML), so a plain tag/text split is safe.
 */

interface WordToken {
  /** Normalized (NFKD-stripped, lowercased) form used for comparison only. */
  word: string;
  /** Char offset range in the ORIGINAL (unmodified) text this token came from. */
  start: number;
  end: number;
}

interface MatchSpan {
  startTokenIdx: number;
  endTokenIdx: number;
  start: number;
  end: number;
}

const MIN_RUN_LENGTH = 3;
// Unicode-aware run of letters/digits — everything else (punctuation,
// whitespace, HTML entity markup like "&amp;") acts as a separator, so
// tokenizing already strips punctuation; no separate step is needed.
const WORD_RE = /[\p{L}\p{N}]+/gu;
const HEADING_OPEN_RE = /^<h[1-6][\s>]/i;
const HEADING_CLOSE_RE = /^<\/h[1-6]>/i;
const TAG_RE = /<[^>]+>/g;

function normalizeWord(raw: string): string {
  return raw.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(text)) !== null) {
    tokens.push({
      word: normalizeWord(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/**
 * Greedy left-to-right scan: at each unconsumed passage token, find the
 * longest run (>= MIN_RUN_LENGTH) that matches a contiguous run anywhere in
 * the query tokens. Both lists are short (a handful of query words; a
 * paragraph-sized passage), so trying every query start position per
 * passage position is cheap — no LCS/suffix-array needed.
 */
function findMatchRuns(passageTokens: WordToken[], queryTokens: string[]): MatchSpan[] {
  const spans: MatchSpan[] = [];
  const n = passageTokens.length;
  const m = queryTokens.length;
  let i = 0;
  while (i < n) {
    let bestLen = 0;
    for (let j = 0; j < m; j++) {
      if (passageTokens[i].word !== queryTokens[j]) continue;
      let len = 1;
      while (
        i + len < n &&
        j + len < m &&
        passageTokens[i + len].word === queryTokens[j + len]
      ) {
        len++;
      }
      if (len > bestLen) bestLen = len;
    }
    if (bestLen >= MIN_RUN_LENGTH) {
      spans.push({
        startTokenIdx: i,
        endTokenIdx: i + bestLen - 1,
        start: passageTokens[i].start,
        end: passageTokens[i + bestLen - 1].end,
      });
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return spans;
}

/**
 * Merges spans whose token ranges are directly back-to-back (no words in
 * between) into one continuous span, so two qualifying runs that happen to
 * sit right next to each other in the passage render as a single unbroken
 * highlight instead of two marks with a seam between them.
 */
function mergeAdjacentSpans(spans: MatchSpan[]): MatchSpan[] {
  if (spans.length === 0) return spans;
  const merged: MatchSpan[] = [spans[0]];
  for (let k = 1; k < spans.length; k++) {
    const prev = merged[merged.length - 1];
    const curr = spans[k];
    if (curr.startTokenIdx === prev.endTokenIdx + 1) {
      merged[merged.length - 1] = {
        startTokenIdx: prev.startTokenIdx,
        endTokenIdx: curr.endTokenIdx,
        start: prev.start,
        end: curr.end,
      };
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

function wrapSpans(text: string, spans: MatchSpan[]): string {
  let result = "";
  let cursor = 0;
  for (const span of spans) {
    result += text.slice(cursor, span.start);
    result += `<mark class="passage-highlight">${text.slice(span.start, span.end)}</mark>`;
    cursor = span.end;
  }
  result += text.slice(cursor);
  return result;
}

function highlightSegment(text: string, queryTokens: string[]): string {
  const tokens = tokenize(text);
  if (tokens.length < MIN_RUN_LENGTH) return text;
  const spans = mergeAdjacentSpans(findMatchRuns(tokens, queryTokens));
  if (spans.length === 0) return text;
  return wrapSpans(text, spans);
}

/**
 * Wraps literal query/passage n-gram overlaps (runs of >= 3 consecutive
 * words, in order) in `<mark class="passage-highlight">` inside already-
 * rendered passage HTML. Never highlights inside headings (h1-h6), so
 * sermon titles/section headers stay untouched — only passage body text
 * is eligible.
 */
export function applyNgramHighlights(html: string, query: string): string {
  if (!html || !query) return html;
  const queryTokens = tokenize(query).map((t) => t.word);
  if (queryTokens.length < MIN_RUN_LENGTH) return html;

  let result = "";
  let cursor = 0;
  let headingDepth = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(html)) !== null) {
    const textSegment = html.slice(cursor, match.index);
    if (textSegment) {
      result += headingDepth > 0 ? textSegment : highlightSegment(textSegment, queryTokens);
    }
    const tag = match[0];
    if (HEADING_OPEN_RE.test(tag)) headingDepth++;
    else if (HEADING_CLOSE_RE.test(tag)) headingDepth = Math.max(0, headingDepth - 1);
    result += tag;
    cursor = TAG_RE.lastIndex;
  }
  const rest = html.slice(cursor);
  if (rest) result += headingDepth > 0 ? rest : highlightSegment(rest, queryTokens);
  return result;
}
