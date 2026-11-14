/**
 * Turns the retrieved sermon context (already cleaned by postprocessRag)
 * into one card per sermon for the passages panel: title, date id,
 * paragraph range, and the excerpt that best matches the question, with
 * the matching words marked. The full passages stay available on the card
 * (rendered through renderMarkdown + applyNgramHighlights as before).
 *
 * Context shape (from the Model API):
 *   ### 1. THE MINISTRY EXPLAINED — 1956-10-01
 *   - Retrieved chunks: 2
 *   Chunks:
 *   - ¶12b–¶13
 *   <passage text…>
 */

export interface RagChunk {
  refs: string;
  text: string;
}

export interface RagSermon {
  title: string;
  /** Sermon date id as cited in answers, e.g. 56-1001 (no M/E/… suffix: the context doesn't carry it). */
  dateId: string;
  date: string;
  chunks: RagChunk[];
  /** The chunks' markdown, for the full view. */
  markdown: string;
}

const HEADER_RE = /^#{2,4}\s+\d+\.\s+(.+?)\s+[—–-]{1,3}\s+(\d{4})-(\d{2})-(\d{2})\s*$/;
const CHUNK_REF_RE = /^-\s+(¶[^\n]*)$/;

/** Split the context into sermons; [] when it isn't in the expected shape (callers fall back to plain markdown). */
export function parseRagSermons(context: string): RagSermon[] {
  const lines = context.split("\n");
  const sermons: RagSermon[] = [];
  let cur: RagSermon | null = null;
  let chunk: RagChunk | null = null;
  let body: string[] = [];

  const closeChunk = () => {
    if (cur && chunk) {
      chunk.text = chunk.text.trim();
      if (chunk.text) cur.chunks.push(chunk);
    }
    chunk = null;
  };
  const closeSermon = () => {
    closeChunk();
    if (cur) {
      cur.markdown = body.join("\n").trim();
      if (cur.chunks.length) sermons.push(cur);
    }
    cur = null;
    body = [];
  };

  for (const line of lines) {
    const h = line.match(HEADER_RE);
    if (h) {
      closeSermon();
      cur = { title: h[1].trim(), dateId: `${h[2].slice(2)}-${h[3]}${h[4]}`, date: `${h[2]}-${h[3]}-${h[4]}`, chunks: [], markdown: "" };
      continue;
    }
    if (!cur) continue;
    const r = line.match(CHUNK_REF_RE);
    if (r) {
      closeChunk();
      chunk = { refs: r[1].trim(), text: "" };
      body.push(`**${r[1].trim()}**`, "");
      continue;
    }
    if (/^-\s+Retrieved chunks:/i.test(line) || /^Chunks:\s*$/i.test(line)) continue;
    if (chunk) chunk.text += `${line}\n`;
    body.push(line);
  }
  closeSermon();
  return sermons;
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Words that carry no meaning for matching (en/es/fr), plus the query's framing words.
const STOP = new Set(
  (
    "the and that this with from what when where which who whom whose have has had were was are been being into onto about above " +
    "their there them they then than your yours our ours his her hers its for not but all any can could would should will shall " +
    "does did doing done how why also just very much many more most some such only other each every said says say show search " +
    "include main sermon sermons brother branham taught teach teaching explain explained where find quote quotes reference references " +
    "que los las del una por para con como sobre sus son fue ser esta este estos esas pero mas muy " +
    "les des une pour dans avec sur sont est qui quoi comment ces cette elle elles nous vous mais plus tres"
  ).split(" "),
);

/** Meaningful words of a query, folded (accent/case-insensitive). */
export function queryTerms(query: string): string[] {
  const words = fold(query).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words)];
}

/** A word matches a term when they share a stem (first 5 letters, or the whole shorter word). */
function matches(word: string, terms: string[]): boolean {
  if (word.length < 3) return false;
  return terms.some((t) => {
    const n = Math.min(5, t.length, word.length);
    return n >= 3 && word.slice(0, n) === t.slice(0, n) && Math.abs(word.length - t.length) <= 4;
  });
}

/** Split prose into sentences (keeps punctuation). */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…”"])\s+(?=[“"A-ZÀ-ÖØ-Ý¶])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Excerpt {
  /** Paragraph refs of the chunk the excerpt comes from. */
  refs: string;
  /** Excerpt split into plain-text pieces; `hit` pieces match the question. */
  parts: { text: string; hit: boolean }[];
  /** True when the excerpt is cut from a longer passage. */
  trimmedStart: boolean;
  trimmedEnd: boolean;
}

const MAX_EXCERPT_CHARS = 320;

/**
 * The window of one to three sentences that shares the most words with the
 * question (ties: earlier wins), from any of the sermon's chunks.
 */
export function bestExcerpt(sermon: RagSermon, terms: string[]): Excerpt {
  let best = { score: -1, chunk: 0, start: 0, end: 1 };
  const all = sermon.chunks.map((c) => sentences(c.text));
  all.forEach((sents, ci) => {
    const scores = sents.map((s) => fold(s).split(/[^a-z0-9]+/).filter((w) => matches(w, terms)).length);
    for (let i = 0; i < sents.length; i++) {
      let len = 0;
      let score = 0;
      for (let j = i; j < Math.min(sents.length, i + 3); j++) {
        len += sents[j].length;
        if (j > i && len > MAX_EXCERPT_CHARS) break;
        score += scores[j];
        // Prefer a denser window: a longer one must add a match to win.
        if (score > best.score) best = { score, chunk: ci, start: i, end: j + 1 };
      }
    }
  });
  const sents = all[best.chunk] ?? [];
  let text = sents.slice(best.start, best.end).join(" ");
  let trimmedEnd = best.end < sents.length;
  if (text.length > MAX_EXCERPT_CHARS + 120) {
    text = text.slice(0, MAX_EXCERPT_CHARS).replace(/\s+\S*$/, "");
    trimmedEnd = true;
  }
  return { refs: sermon.chunks[best.chunk]?.refs ?? "", parts: markTerms(text, terms), trimmedStart: best.start > 0, trimmedEnd };
}

/** Split text into pieces, marking words that match the question. */
export function markTerms(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  const re = /[\p{L}\p{N}’']+/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const word = m[0];
    const hit = terms.length > 0 && matches(fold(word).replace(/[’']/g, ""), terms);
    if (!hit) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: word, hit: true });
    last = m.index! + word.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  // Join hits separated only by spaces into one mark, so phrases read as one highlight.
  const merged: { text: string; hit: boolean }[] = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    const prev2 = merged[merged.length - 2];
    if (p.hit && prev && !prev.hit && /^\s+$/.test(prev.text) && prev2?.hit) {
      prev2.text += prev.text + p.text;
      merged.pop();
    } else merged.push({ ...p });
  }
  return merged;
}
