/**
 * The day's verse in the reader's language. English is the King James Version
 * (bible-api.com, see ./kjv.ts); French is Louis Segond 1910 and Spanish
 * Reina-Valera 1909 — the public-domain Bibles French- and Spanish-speaking
 * believers read — from getbible.net (free, no key). The curated list and
 * the admin's "Change verse" use English references ("Psalm 23:1"); a stored
 * French/Spanish reference ("Psaumes 23:1") is accepted too when a day is
 * regenerated.
 */

import { fetchKjvPassage, KjvLookupError } from "./kjv";
import type { AltarLanguage } from "./types";

export interface BiblePassage {
  /** Reference in the passage's language, e.g. "Psaumes 91:1". */
  reference: string;
  text: string;
  /** Short version label shown after the reference. */
  version: string;
}

export class BibleLookupError extends KjvLookupError {}

const TRANSLATION: Record<Exclude<AltarLanguage, "en">, { id: string; version: string }> = {
  fr: { id: "ls1910", version: "LSG" },
  es: { id: "valera", version: "RV1909" },
};

/** English book names (and common variants) → book number, KJV order. */
const BOOKS: string[][] = [
  ["Genesis"], ["Exodus"], ["Leviticus"], ["Numbers"], ["Deuteronomy"], ["Joshua"], ["Judges"], ["Ruth"],
  ["1 Samuel"], ["2 Samuel"], ["1 Kings"], ["2 Kings"], ["1 Chronicles"], ["2 Chronicles"], ["Ezra"], ["Nehemiah"],
  ["Esther"], ["Job"], ["Psalm", "Psalms"], ["Proverbs"], ["Ecclesiastes"], ["Song of Solomon", "Song of Songs"],
  ["Isaiah"], ["Jeremiah"], ["Lamentations"], ["Ezekiel"], ["Daniel"], ["Hosea"], ["Joel"], ["Amos"], ["Obadiah"],
  ["Jonah"], ["Micah"], ["Nahum"], ["Habakkuk"], ["Zephaniah"], ["Haggai"], ["Zechariah"], ["Malachi"],
  ["Matthew"], ["Mark"], ["Luke"], ["John"], ["Acts"], ["Romans"], ["1 Corinthians"], ["2 Corinthians"],
  ["Galatians"], ["Ephesians"], ["Philippians"], ["Colossians"], ["1 Thessalonians"], ["2 Thessalonians"],
  ["1 Timothy"], ["2 Timothy"], ["Titus"], ["Philemon"], ["Hebrews"], ["James"], ["1 Peter"], ["2 Peter"],
  ["1 John"], ["2 John"], ["3 John"], ["Jude"], ["Revelation"],
];

const norm = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const ENGLISH = new Map<string, number>(BOOKS.flatMap((names, i) => names.map((n) => [norm(n), i + 1] as const)));

/** Local book names per translation (fetched once per Worker instance). */
const localBooks = new Map<string, Promise<Map<string, number>>>();

function booksOf(translation: string): Promise<Map<string, number>> {
  let p = localBooks.get(translation);
  if (!p) {
    p = fetch(`https://api.getbible.net/v2/${translation}/books.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, { nr: number; name: string }>) => new Map(Object.values(d).map((b) => [norm(b.name), b.nr] as const)))
      .catch(() => new Map<string, number>());
    localBooks.set(translation, p);
  }
  return p;
}

const REF_RE = /^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/;

/** Psalm titles Louis Segond prints inside verse 1 ("Cantique de David. L’Éternel est mon berger…"). */
const PSALM_TITLE_RE =
  /^(?:(?:Au chef des chantres|Cantique|Psaume|Prière|Maskil|Hymne|Louange|Complainte|Miktam|Chant|Prière de|De David|Des fils de Koré|D’Asaph|De Salomon)\b[^.]*\.\s+)+/u;

/**
 * Louis Segond numbers a few chapters differently from the KJV. Outside the
 * Psalms (handled below from the chapter's verse counts) these are the ones
 * in the curated list: "book:chapter" → added to the KJV verse number.
 * Checked 2026-11-17 against every chapter of FAMILY_ALTAR_VERSES; Reina-Valera
 * 1909 matches the KJV everywhere.
 */
const LSG_OFFSETS: Record<string, number> = { "21:12": 2, "23:9": -1, "23:64": -1 };

type Chapter = { name?: string; verses?: { verse: number; text: string }[] };

async function getChapter(translation: string, book: number, chapter: string): Promise<Chapter> {
  const res = await fetch(`https://api.getbible.net/v2/${translation}/${book}/${chapter}.json`, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw new BibleLookupError(`Chapter ${chapter} wasn't found in this Bible.`);
  if (!res.ok) throw new BibleLookupError(`The Bible text service returned ${res.status}. Try again.`);
  return ((await res.json().catch(() => null)) as Chapter | null) ?? {};
}

/** Fix the all-capital first word some editions print at a chapter's start ("EL que habita…"). */
function fixDropCap(text: string): string {
  return text.replace(/^(\p{Lu})(\p{Lu}+)(?=[\s,;:.!?])/u, (_, a: string, b: string) => a + b.toLowerCase());
}

export async function fetchPassage(reference: string, language: AltarLanguage): Promise<BiblePassage> {
  if (language === "en") {
    const p = await fetchKjvPassage(reference);
    return { ...p, version: "KJV" };
  }
  const { id, version } = TRANSLATION[language];
  const m = REF_RE.exec(reference.trim());
  if (!m) throw new BibleLookupError(`"${reference}" isn't a Bible reference like "Psalm 23:1".`);
  const [, bookName, chapter, from, to] = m;
  const englishBook = ENGLISH.get(norm(bookName));
  const book = englishBook ?? (await booksOf(id)).get(norm(bookName));
  if (!book) throw new BibleLookupError(`"${bookName}" isn't a book name the Bible lookup recognises.`);

  const data = await getChapter(id, book, chapter);

  // An English (KJV-numbered) reference may point at a different verse number in Louis Segond.
  let offset = 0;
  if (language === "fr" && englishBook) {
    if (book === 19) {
      // Psalm titles are numbered as verses in Segond: shift by how many extra verses the chapter has.
      const kjv = await getChapter("kjv", book, chapter);
      offset = Math.max(0, (data.verses?.length ?? 0) - (kjv.verses?.length ?? 0));
    } else {
      offset = LSG_OFFSETS[`${book}:${chapter}`] ?? 0;
    }
  }
  const first = Number(from) + offset;
  const last = (to ? Number(to) : Number(from)) + offset;
  const verses = (data?.verses ?? [])
    .filter((v) => v.verse >= first && v.verse <= last)
    .map((v) => {
      // keep French no-break spaces before ; : ! ? (drop the ordinary space next to one),
      // turn Segond's stray thin spaces into plain ones, collapse whitespace
      const t = v.text
        .replace(/\u2009/g, " ")
        .replace(/[ \t\r\n]+/g, " ")
        .replace(/ (?=[\u00a0\u202f])|(?<=[\u00a0\u202f]) /g, "")
        .trim();
      if (v.verse !== 1) return t;
      return fixDropCap(book === 19 ? t.replace(PSALM_TITLE_RE, "") : t);
    })
    .filter(Boolean);
  if (!data.name || verses.length !== last - first + 1) {
    throw new BibleLookupError(`No ${version} text found for "${reference}".`);
  }
  const range = last > first ? `${first}-${last}` : `${first}`;
  return { reference: `${data.name}:${range}`, text: verses.join(" "), version };
}
