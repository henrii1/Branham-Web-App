"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Conversation } from "@/lib/chat/types";
import { formatRelativeTime } from "@/lib/utils/time";

interface ConversationSidebarProps {
  user: User;
  conversations: Conversation[];
  activeConversationId: string;
  isLoading: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onClose?: () => void;
}

interface ConversationGroup {
  label: string;
  items: Conversation[];
}

function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekAgoStart = new Date(todayStart.getTime() - 7 * 86_400_000);
  const monthAgoStart = new Date(todayStart.getTime() - 30 * 86_400_000);

  const groups: ConversationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Previous 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= todayStart) groups[0].items.push(conv);
    else if (d >= yesterdayStart) groups[1].items.push(conv);
    else if (d >= weekAgoStart) groups[2].items.push(conv);
    else if (d >= monthAgoStart) groups[3].items.push(conv);
    else groups[4].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ConversationSidebar({
  user,
  conversations,
  activeConversationId,
  isLoading,
  onNewChat,
  onSelectConversation,
  onClose,
}: ConversationSidebarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const groups = groupConversations(conversations);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-sm font-semibold text-foreground">
          Branham Sermons AI
        </h1>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close sidebar"
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
        )}
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose?.();
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New chat
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3"
        aria-label="Conversation history"
      >
        {isLoading ? (
          <div className="space-y-2 px-2 py-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Your conversations will appear here
          </p>
        ) : (
          <div className="space-y-4 pb-3">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-1 px-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                  {group.label}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    return (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectConversation(conv.id);
                            onClose?.();
                          }}
                          className={`group flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-zinc-200 font-medium text-foreground dark:bg-zinc-800"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                          }`}
                          title={conv.title ?? "New conversation"}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {conv.title || "New conversation"}
                          </span>
                          <span className="ml-2 flex-shrink-0 text-[10px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500">
                            {formatRelativeTime(conv.updatedAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
            {(user.email?.[0] ?? "?").toUpperCase()}
          </div>
          <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
            {user.email}
          </span>
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-zinc-300"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
