"use client";

import type { ThemePreference } from "@/lib/theme";

interface ThemePreferencePickerProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  disabled?: boolean;
}

export function ThemePreferencePicker({
  theme,
  onThemeChange,
  disabled = false,
}: ThemePreferencePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onThemeChange("light")}
        disabled={disabled}
        aria-pressed={theme === "light"}
        className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
          theme === "light"
            ? "border-zinc-900 bg-zinc-100 shadow-sm dark:border-zinc-100 dark:bg-zinc-800"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        }`}
      >
        <div className="mb-3 flex h-16 rounded-xl border border-zinc-200 bg-[#eef3ed] p-2 dark:border-zinc-700">
          <div className="w-1/3 rounded-lg bg-white shadow-sm" />
          <div className="ml-2 flex-1 rounded-lg bg-[#dfeadf]" />
        </div>
        <p className="text-sm font-medium text-foreground">Light</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Pale green and white, bright and easy to read by day.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onThemeChange("dark")}
        disabled={disabled}
        aria-pressed={theme === "dark"}
        className={`rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
          theme === "dark"
            ? "border-zinc-900 bg-zinc-900 text-zinc-100 shadow-sm dark:border-zinc-100 dark:bg-zinc-800"
            : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        }`}
      >
        <div className="mb-3 flex h-16 rounded-xl border border-[#2b322e] bg-[#0f1411] p-2">
          <div className="w-1/3 rounded-lg bg-[#090d0b]" />
          <div className="ml-2 flex flex-1 items-end rounded-lg bg-[#1a201c] p-1.5">
            <div className="h-2 w-8 rounded-full bg-[#8fc29e]" />
          </div>
        </div>
        <p className="text-sm font-medium">Dark</p>
        <p className="mt-1 text-xs text-zinc-400">
          Soft charcoal with green accents, gentle on the eyes at night.
        </p>
      </button>
    </div>
  );
}
