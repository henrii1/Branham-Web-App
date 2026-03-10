"use client";

import Link from "next/link";

export function AnonymousBanner() {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <svg
              className="h-4.5 w-4.5"
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
          <div>
            <p className="text-sm font-medium text-foreground">
              You&apos;re chatting as a guest.
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign up to save your conversations and pick up right where you
              left off.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/faq"
            className="rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Popular Questions
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
