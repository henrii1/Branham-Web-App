/**
 * Exact King James text for a verse reference, from bible-api.com (public
 * domain, free). Its text contains stray line breaks inside verses, so each
 * verse is whitespace-normalized and the verses joined with single spaces.
 */

export interface KjvPassage {
  /** Canonical reference as the API spells it, e.g. "Psalms 91:1". */
  reference: string;
  text: string;
}

export class KjvLookupError extends Error {}

export async function fetchKjvPassage(reference: string): Promise<KjvPassage> {
  const url = `https://bible-api.com/${encodeURIComponent(reference.trim())}?translation=kjv`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw new KjvLookupError(`"${reference}" isn't a Bible reference the KJV lookup recognises.`);
  if (!res.ok) throw new KjvLookupError(`The Bible text service returned ${res.status}. Try again.`);

  const data = (await res.json().catch(() => null)) as {
    reference?: string;
    verses?: { text?: string }[];
    error?: string;
  } | null;
  const verses = (data?.verses ?? []).map((v) => (v.text ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!data?.reference || verses.length === 0) {
    throw new KjvLookupError(data?.error ?? `No KJV text found for "${reference}".`);
  }
  return { reference: data.reference, text: verses.join(" ") };
}
