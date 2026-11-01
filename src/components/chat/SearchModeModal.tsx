"use client";

import { useState } from "react";
import { getChatStrings } from "@/lib/i18n/chatStrings";
import { saveSearchMode, type SearchMode } from "@/lib/chat/searchMode";
import { saveBrowserSearchMode } from "@/lib/chat/searchModeTried";

/**
 * Asked once: Scripture or the sermons? Signed in, right after sign-up
 * (needsSearchModeChoice), the answer becomes the account's default and
 * /profile can change it. Not signed in, it's asked once per browser and
 * kept there. No backdrop dismiss and no close button: one of the two
 * answers is the way out.
 */
export function SearchModeModal({
  language = "en",
  signedIn,
  onChosen,
}: {
  language?: string;
  signedIn: boolean;
  onChosen: (mode: SearchMode) => void;
}) {
  const s = getChatStrings(language);
  const [saving, setSaving] = useState<SearchMode | null>(null);

  async function choose(mode: SearchMode) {
    if (saving) return;
    setSaving(mode);
    saveBrowserSearchMode(mode);
    if (signedIn) {
      try {
        await saveSearchMode(mode);
      } catch (err) {
        // Still used in this browser; the account is updated next time it loads.
        console.error("Failed to save search mode:", err);
      }
    }
    onChosen(mode);
  }

  const choice = (mode: SearchMode, title: string, body: string) => (
    <button
      type="button"
      onClick={() => choose(mode)}
      disabled={!!saving}
      className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
    >
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{body}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="search-mode-heading"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full rounded-t-2xl bg-[var(--surface-base)] p-6 shadow-xl sm:max-w-sm sm:rounded-2xl dark:border dark:border-zinc-700">
        <h2 id="search-mode-heading" className="font-display text-xl text-foreground">
          {s.searchModeModalHeading}
        </h2>
        <p className="mt-1.5 mb-4 text-sm text-zinc-600 dark:text-zinc-400">{s.searchModeModalBody}</p>
        <div className="space-y-2.5">
          {choice("bible", s.searchModeModalBibleTitle, s.searchModeModalBibleBody)}
          {choice("sermons", s.searchModeModalSermonsTitle, s.searchModeModalSermonsBody)}
        </div>
        {signedIn && <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{s.searchModeModalNote}</p>}
      </div>
    </div>
  );
}
