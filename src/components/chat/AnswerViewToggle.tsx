"use client";

import type { AnswerViewMode } from "@/lib/chat/types";

interface AnswerViewToggleProps {
  mode: AnswerViewMode;
  onChange: (mode: AnswerViewMode) => void;
  fullLabel: string;
  quotesLabel: string;
}

function segmentClassName(active: boolean): string {
  return `rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
    active
      ? "bg-white text-foreground shadow-sm dark:bg-zinc-700"
      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`;
}

export function AnswerViewToggle({
  mode,
  onChange,
  fullLabel,
  quotesLabel,
}: AnswerViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Answer view"
      className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "full"}
        onClick={() => onChange("full")}
        className={segmentClassName(mode === "full")}
      >
        {fullLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "quotes"}
        onClick={() => onChange("quotes")}
        className={segmentClassName(mode === "quotes")}
      >
        {quotesLabel}
      </button>
    </div>
  );
}
