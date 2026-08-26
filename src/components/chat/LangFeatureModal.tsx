"use client";

import Link from "next/link";
import { useState } from "react";

const SEEN_KEY = "branham_lang_feature_v1_seen";

export function LangFeatureModal() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(SEEN_KEY));

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Sheet on mobile (slides up from bottom), centered card on sm+ */}
      <div className="relative w-full rounded-t-2xl bg-[var(--surface-base)] p-6 shadow-xl sm:max-w-sm sm:rounded-2xl dark:border dark:border-zinc-700">
        {/* Close */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="mb-4 flex items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-zinc-700 dark:text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253"
            />
          </svg>
          <h2 className="text-base font-semibold text-foreground">
            Spanish &amp; French are now available
          </h2>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          You can now ask questions and receive full answers in Spanish or
          French. Set your preferred language in your profile.
        </p>

        <div className="mb-5 space-y-2 rounded-xl border border-zinc-200 bg-[var(--surface-soft)] p-3.5 dark:border-zinc-700">
          <div className="flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-base">🇪🇸</span>
            <span>385 sermons available in Spanish</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-base">🇫🇷</span>
            <span>359 sermons available in French</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/profile"
            onClick={dismiss}
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Set my language
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}