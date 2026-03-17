"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Conversation } from "@/lib/chat/types";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface ConversationSidebarProps {
  user: User | null;
  conversations: Conversation[];
  activeConversationId: string;
  isLoading: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void;
  onCollapse?: () => void;
}

interface ConversationGroup {
  label: string;
  items: Conversation[];
}

function groupConversations(
  conversations: Conversation[],
): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
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

// ── Three-dot menu + inline rename per conversation item ──────────────

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onClose?: () => void;
}

function ConversationItem({
  conv,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onClose,
}: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editValue, setEditValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Auto-focus the rename input
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startRename() {
    setMenuOpen(false);
    setConfirmingDelete(false);
    setEditValue(conv.title || "");
    setEditing(true);
  }

  function commitRename() {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== (conv.title || "")) {
      onRename(trimmed);
    }
  }

  function startDelete() {
    setConfirmingDelete(true);
  }

  function confirmDelete() {
    setMenuOpen(false);
    setConfirmingDelete(false);
    onDelete();
  }

  if (editing) {
    return (
      <li>
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1.5 dark:bg-zinc-800">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commitRename}
            className="min-w-0 flex-1 rounded bg-white px-2 py-1 text-sm text-foreground outline-none ring-1 ring-blue-500 dark:bg-zinc-900"
            aria-label="Rename conversation"
          />
        </div>
      </li>
    );
  }

  return (
    <li className="group/item relative">
      <button
        type="button"
        onClick={() => {
          onSelect();
          onClose?.();
        }}
        className={`flex w-full items-center rounded-lg px-2 py-2 text-left text-sm transition-colors ${
          isActive
            ? "bg-zinc-200 font-medium text-foreground dark:bg-zinc-800"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        }`}
        title={conv.title ?? "New conversation"}
        aria-current={isActive ? "page" : undefined}
      >
        <span className="min-w-0 flex-1 truncate pr-6">
          {conv.title || "New conversation"}
        </span>
      </button>

      {/* Three-dot trigger */}
      <div
        ref={menuRef}
        className={`absolute top-1 right-1 ${menuOpen ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"} transition-opacity`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
            setConfirmingDelete(false);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          aria-label="Conversation options"
        >
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM10 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM10 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
          </svg>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute top-8 right-0 z-50 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {confirmingDelete ? (
              <>
                <p className="px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Delete this chat?
                </p>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRename}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z"
                    />
                  </svg>
                  Rename
                </button>
                <button
                  type="button"
                  onClick={startDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────

export function ConversationSidebar({
  user,
  conversations,
  activeConversationId,
  isLoading,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onClose,
  onCollapse,
}: ConversationSidebarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const groups = groupConversations(conversations);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-sidebar)]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <BrandLogo priority showName={false} size={34} />
        <div className="flex items-center gap-1.5">
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Collapse sidebar"
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
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose?.();
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
          <div className="px-2 py-8">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-[var(--surface-base)] px-4 py-6 text-center dark:border-zinc-700">
              <p className="text-sm font-medium text-foreground">
                {user ? "No conversations yet" : "History stays empty as a guest"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
                {user
                  ? "Your recent chats will show up here once you ask a question."
                  : "Sign up to save your Branham Sermons Assistant conversations and return to them later."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-3">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="mb-1 px-2 text-[11px] font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
                  {group.label}
                </h3>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      onSelect={() => onSelectConversation(conv.id)}
                      onRename={(newTitle) =>
                        onRenameConversation(conv.id, newTitle)
                      }
                      onDelete={() => onDeleteConversation(conv.id)}
                      onClose={onClose}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <Link
          href="/faq"
          className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Popular Questions
        </Link>
        <a
          href="mailto:info@branhamsermons.ai"
          className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          info@branhamsermons.ai
        </a>
        {user ? (
          <>
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
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <Link
              href="/signup"
              className="rounded-lg px-2 py-2 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-2 py-1.5 text-center text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
