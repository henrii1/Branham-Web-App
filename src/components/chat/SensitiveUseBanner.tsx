"use client";

import { getChatStrings } from "@/lib/i18n/chatStrings";

// Always visible for as long as the chat surface is mounted — deliberately
// no dismiss control. This is a standing safety notice, not a one-time
// feature announcement like ShareFeatureBanner.
export function SensitiveUseBanner({ language = "en" }: { language?: string }) {
  const s = getChatStrings(language);

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-3 px-4 py-2">
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
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>

        <p className="min-w-0 flex-1 text-xs font-medium text-amber-900 dark:text-amber-200">
          {s.sensitiveBannerText}
        </p>
      </div>
    </div>
  );
}
