/**
 * Family Altar dates. Days are plain "YYYY-MM-DD" strings (calendar dates,
 * not instants) and all arithmetic is done in UTC so no time zone can shift
 * a day. Weeks run Monday–Sunday. "Today" for a reader is their own local
 * calendar date (localTodayIso), decided in the browser.
 */

import { FAMILY_ALTAR_VERSES } from "./verses";

const DAY_MS = 86_400_000;

/** A fixed Monday; week numbers count from here. */
const EPOCH_MONDAY = "2026-01-05";

/**
 * Stride through the verse list. Coprime with its length (365 = 5 × 73), so
 * consecutive days visit every verse once before any repeats, and
 * neighbouring days come from different parts of the Bible.
 */
const VERSE_STRIDE = 97;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  // Round-trip so impossible dates (2026-02-31) are rejected, not rolled over.
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS);
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const dow = new Date(toUtcMs(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

/** The seven dates (Monday … Sunday) of the week starting `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Today's UTC calendar date. */
export function utcTodayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The reader's own calendar date (browser local time). */
export function localTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The default verse reference for a calendar day. */
export function defaultVerseFor(day: string): string {
  const n = Math.round((toUtcMs(day) - toUtcMs(EPOCH_MONDAY)) / DAY_MS);
  const len = FAMILY_ALTAR_VERSES.length;
  const idx = (((n * VERSE_STRIDE) % len) + len) % len;
  return FAMILY_ALTAR_VERSES[idx];
}
