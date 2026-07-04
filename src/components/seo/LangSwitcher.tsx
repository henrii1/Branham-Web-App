"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

interface LangSwitcherProps {
  current: "en" | "es" | "fr";
  hrefs: { en: string; es: string; fr: string };
}

export function LangSwitcher({ current, hrefs }: LangSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Switch language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 1 0 20M12 2a14.5 14.5 0 0 0 0 20M2 12h20" />
        </svg>
        <span>{current.toUpperCase()}</span>
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {(["en", "es", "fr"] as const).map((lang) => {
            const isActive = lang === current;
            return isActive ? (
              <div
                key={lang}
                className="flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                <span>{LANG_LABELS[lang]}</span>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
            ) : (
              <Link
                key={lang}
                href={hrefs[lang]}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {LANG_LABELS[lang]}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}