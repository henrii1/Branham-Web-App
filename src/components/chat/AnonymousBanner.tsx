"use client";

import Link from "next/link";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface AnonymousBannerProps {
  strings: ChatStrings;
  faqHref: string;
  /** Where sign-up returns to (the same search). */
  next?: string;
}

/** Guest notice: one compact row on wide screens so the chat keeps its height. */
export function AnonymousBanner({ strings, faqHref, next }: AnonymousBannerProps) {
  return (
    <div className="px-3 py-2 sm:px-4">
      <div className="flex flex-row items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-[var(--surface-soft)] px-3 py-2 shadow-sm sm:px-4 dark:border-zinc-700">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--home-meadow)] text-white dark:bg-[var(--home-leaf)] dark:text-[var(--home-night)]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0 1 19.5 12.75v5.25a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18v-5.25A2.25 2.25 0 0 1 6.75 10.5Z"
              />
            </svg>
          </div>
          <p className="min-w-0 text-[13px] leading-snug sm:text-sm">
            <span className="font-medium text-foreground">{strings.guestHeading}</span>{" "}
            <span className="hidden text-zinc-500 sm:inline dark:text-zinc-400">{strings.guestSubtext}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            prefetch={false}
            href={faqHref}
            className="hidden rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-xs sm:inline-flex font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {strings.popularQuestions}
          </Link>
          <Link
            prefetch={false}
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="rounded-xl bg-[var(--home-meadow)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#265a39] dark:bg-[var(--home-leaf)] dark:text-[var(--home-night)] dark:hover:bg-[#a6d2b2]"
          >
            {strings.signUp}
          </Link>
        </div>
      </div>
    </div>
  );
}