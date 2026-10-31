"use client";

/** Christianity Seen in Nature reading progress: kept only in this browser. */

import { useSyncExternalStore } from "react";

const READ_KEY = "nature-series-read";
const CHANGE_EVENT = "nature-series-read-change";

function readRaw(): string {
  try {
    return localStorage.getItem(READ_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Slugs this reader has opened, or null before hydration (unknown). */
export function useSeriesRead(): Set<string> | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  if (raw === null) return null;
  try {
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSeriesRead(slug: string) {
  try {
    const list = JSON.parse(readRaw());
    const slugs: string[] = Array.isArray(list) ? list : [];
    if (slugs.includes(slug)) return;
    localStorage.setItem(READ_KEY, JSON.stringify([...slugs, slug]));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* storage blocked: progress just isn't kept */
  }
}
