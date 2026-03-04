"use client";

import Link from "next/link";

export function AnonymousBanner() {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Your conversations aren&apos;t saved.{" "}
        <Link
          href="/signup"
          className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Sign up
        </Link>{" "}
        to keep your history.
      </p>
    </div>
  );
}
