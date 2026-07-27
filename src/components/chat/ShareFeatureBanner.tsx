"use client";

import { useState } from "react";
import { getChatStrings } from "@/lib/i18n/chatStrings";

const DISMISS_KEY = "branham_share_feature_announce_v1_dismissed";

export function ShareFeatureBanner({ language = "en" }: { language?: string }) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(DISMISS_KEY));
  const [dismissing, setDismissing] = useState(false);

  const s = getChatStrings(language);

  function dismiss() {
    setDismissing(true);
    localStorage.setItem(DISMISS_KEY, "true");
    setTimeout(() => setVisible(false), 250);
  }

  if (!visible) return null;

  return (
    <div
      className={`border-b border-amber-200 bg-amber-50 transition-opacity duration-250 dark:border-amber-900/40 dark:bg-amber-950/20 ${
        dismissing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <svg
          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.769-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
          />
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {s.shareAnnounceHeading}
          </p>
          <p className="hidden text-xs text-amber-700 sm:block dark:text-amber-400">
            {s.shareAnnounceSubtext}
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-200"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
