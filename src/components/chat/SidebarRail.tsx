"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface SidebarRailProps {
  user: User | null;
  onExpand: () => void;
  onNewChat: () => void;
}

export function SidebarRail({
  user,
  onExpand,
  onNewChat,
}: SidebarRailProps) {
  return (
    <div className="flex h-full flex-col items-center justify-between bg-[var(--surface-sidebar)] px-3 py-4">
      <div className="flex w-full flex-col items-center gap-3">
        <BrandLogo
          showName={false}
          size={34}
          className="justify-center"
        />

        <button
          type="button"
          onClick={onExpand}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--surface-base)] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Expand history sidebar"
          title="Show history"
        >
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
              d="M8.25 6.75 3.75 12l4.5 5.25m12-10.5h-9m9 10.5h-9"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--surface-base)] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Start a new chat"
          title="New chat"
        >
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <Link
          href="/faq"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--surface-base)] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Popular Questions"
          title="Popular Questions"
        >
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
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
        </Link>

        {user ? (
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white transition-opacity hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            aria-label="Profile"
            title={user.email ?? "Profile"}
          >
            {(user.email?.[0] ?? "?").toUpperCase()}
          </Link>
        ) : (
          <Link
            href="/signup"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--surface-base)] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Sign up"
            title="Sign up"
          >
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
                d="M15.75 6.75h3.75m0 0v3.75m0-3.75L15 11.25m-3 8.25a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z"
              />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
