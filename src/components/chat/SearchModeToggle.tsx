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
        className={`relative whitespace-nowrap rounded-full border px-3.5 py-1 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          active
            ? "border-[var(--home-meadow)] bg-[var(--home-meadow)] text-white dark:border-[var(--home-leaf)] dark:bg-[var(--home-leaf)] dark:text-[var(--home-night)]"
            : "border-zinc-200 bg-[var(--surface-base)] text-zinc-600 hover:border-[var(--home-meadow)] hover:text-foreground dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-[var(--home-leaf)]"
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
      className="inline-flex items-center gap-1.5"
    >
      {option("bible", bibleLabel)}
      {option("sermons", sermonsLabel)}
    </div>
  );
}
