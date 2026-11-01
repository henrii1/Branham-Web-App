"use client";

import type { SearchMode } from "@/lib/chat/searchMode";
import { useTriedModes } from "@/lib/chat/searchModeTried";

interface SearchModeToggleProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
  sermonsLabel: string;
  bibleLabel: string;
  groupLabel: string;
  disabled?: boolean;
}

/**
 * Sermon search / Bible search, just above the composer. The option the
 * reader hasn't asked a question with yet glows softly, so the other mode is
 * noticed; it stops once they've tried it (useTriedModes).
 */
export function SearchModeToggle({ mode, onChange, sermonsLabel, bibleLabel, groupLabel, disabled }: SearchModeToggleProps) {
  // Null until hydrated: no nudge until then.
  const tried = useTriedModes();

  const option = (value: SearchMode, label: string) => {
    const active = mode === value;
    const nudge = !active && !!tried && !tried.has(value);
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={disabled}
        onClick={() => !active && onChange(value)}
        className={`relative whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          active
            ? "bg-white text-foreground shadow-sm dark:bg-zinc-700"
            : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        } ${nudge ? "search-mode-nudge" : ""}`}
      >
        {value === "bible" && (
          <svg className="mr-1 inline h-3.5 w-3.5 -translate-y-px" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        )}
        {label}
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
    >
      {option("sermons", sermonsLabel)}
      {option("bible", bibleLabel)}
    </div>
  );
}
