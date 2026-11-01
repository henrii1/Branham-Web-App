"use client";

import { useSyncExternalStore } from "react";
import type { SearchMode } from "./searchMode";

// The nudge on the switch's other option stops once this reader has tried it.
const TRIED_KEY = "search-mode-tried";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSet: ReadonlySet<SearchMode> = new Set();

function readTried(): ReadonlySet<SearchMode> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRIED_KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const list = JSON.parse(raw ?? "[]");
      cachedSet = new Set(Array.isArray(list) ? list.filter((m): m is SearchMode => m === "bible" || m === "sermons") : []);
    } catch {
      cachedSet = new Set();
    }
  }
  return cachedSet;
}

/** Modes this reader has asked a question with; null before hydration. */
export function useTriedModes(): ReadonlySet<SearchMode> | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readTried,
    () => null,
  );
}

export function markModeTried(mode: SearchMode): void {
  if (readTried().has(mode)) return;
  try {
    localStorage.setItem(TRIED_KEY, JSON.stringify([...readTried(), mode]));
  } catch {
    /* storage blocked */
  }
  listeners.forEach((cb) => cb());
}
