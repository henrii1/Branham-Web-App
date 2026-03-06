"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthGate";
import { generateId } from "@/lib/utils/ids";
import {
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
  fetchConversations,
} from "@/lib/db/queries";
import type { Conversation } from "@/lib/chat/types";
import type { ConversationRow } from "@/lib/db/queries";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import { TypewriterRenderer } from "./TypewriterRenderer";
import { LoginModal } from "@/components/chat/LoginModal";
import { DragDivider } from "@/components/chat/DragDivider";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { AnonymousBanner } from "@/components/chat/AnonymousBanner";

interface SeoShellProps {
  slug: string;
  question: string;
  answerMarkdown: string;
  ragContext: string;
  conversationSummary: string | null;
}

const DEFAULT_PANEL_RATIO = 0.4;

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    conversationSummary: row.conversation_summary,
    updatedAt: row.updated_at,
  };
}

export function SeoShell({
  slug,
  question,
  answerMarkdown,
  ragContext,
  conversationSummary,
}: SeoShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const isAnonymous = !user;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "sources">("chat");
  const [panelRatio, setPanelRatio] = useState(DEFAULT_PANEL_RATIO);
  const [seeding, setSeeding] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const panelsRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const processedRag = postprocessRag(ragContext);
  const ragHtml = renderMarkdown(processedRag);

  // ── Load sidebar conversations (logged-in only) ─────────────────────
  useEffect(() => {
    if (!user) return;
    setConversationsLoading(true);
    fetchConversations(user.id)
      .then((rows) => setConversations(rows.map(rowToConversation)))
      .catch(console.error)
      .finally(() => setConversationsLoading(false));
  }, [user]);

  const handleNewChat = useCallback(() => {
    router.push("/chat");
    setMobileDrawerOpen(false);
  }, [router]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
      setMobileDrawerOpen(false);
    },
    [router],
  );

  const handleComposerFocus = useCallback(() => {
    if (isAnonymous) {
      localStorage.setItem("pending_seo_slug", slug);
      setShowLoginModal(true);
    }
  }, [isAnonymous, slug]);

  const handleFollowUp = useCallback(
    async (content: string) => {
      if (isAnonymous) {
        setShowLoginModal(true);
        return;
      }
      if (seeding || !user) return;
      setSeeding(true);

      try {
        const convId = generateId();
        const userMsgId = generateId();
        const assistantMsgId = generateId();

        await createConversation(convId, user.id, question);
        await saveMessage(userMsgId, convId, user.id, "user", question);
        await saveMessage(assistantMsgId, convId, user.id, "assistant", answerMarkdown);
        await Promise.all([
          upsertRag(convId, postprocessRag(ragContext), question),
          updateConversationAfterTurn(convId, conversationSummary),
        ]);

        localStorage.setItem(
          "seo_followup",
          JSON.stringify({ conversationId: convId, query: content }),
        );
        router.push(`/chat/${convId}`);
      } catch (err) {
        console.error("Failed to seed conversation from SEO:", err);
        setSeeding(false);
      }
    },
    [isAnonymous, user, seeding, question, answerMarkdown, ragContext, conversationSummary, router],
  );

  return (
    <div className="flex h-dvh bg-background">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-zinc-200 lg:block dark:border-zinc-800">
        <ConversationSidebar
          user={user ?? null}
          conversations={conversations}
          activeConversationId=""
          isLoading={conversationsLoading}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onRenameConversation={() => {}}
          onDeleteConversation={() => {}}
        />
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 h-full w-72 shadow-xl">
            <ConversationSidebar
              user={user ?? null}
              conversations={conversations}
              activeConversationId=""
              isLoading={conversationsLoading}
              onNewChat={handleNewChat}
              onSelectConversation={handleSelectConversation}
              onRenameConversation={() => {}}
              onDeleteConversation={() => {}}
              onClose={() => setMobileDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Mobile header ── */}
        <header className="flex flex-col border-b border-zinc-200 bg-white lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Open menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <a href="/" className="text-sm font-semibold text-foreground">
              Branham Sermons AI
            </a>

            {!isAnonymous ? (
              <Link
                href="/faq"
                className="text-xs font-medium text-zinc-400 transition-colors hover:text-foreground"
              >
                Popular Questions
              </Link>
            ) : (
              <div className="w-8" />
            )}
          </div>

          <nav
            className="flex border-t border-zinc-100 dark:border-zinc-800"
            role="tablist"
            aria-label="SEO panels"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "chat"}
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "border-b-2 border-zinc-900 text-foreground dark:border-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              Answer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
              className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
                activeTab === "sources"
                  ? "border-b-2 border-zinc-900 text-foreground dark:border-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              Sources
            </button>
          </nav>
        </header>

        {/* ── Anonymous banner (desktop only) ── */}
        {isAnonymous && (
          <div className="hidden border-b border-zinc-200 lg:block dark:border-zinc-800">
            <AnonymousBanner />
          </div>
        )}

        {/* ── Desktop: two-panel layout ── */}
        <div
          ref={panelsRef}
          className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex"
        >
          <div
            ref={sourcesRef}
            className="min-h-0 overflow-hidden border-b border-zinc-100 dark:border-zinc-800"
            style={{ flex: `${panelRatio} 0 0` }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Sources
                </h2>
                {!isAnonymous && (
                  <Link
                    href="/faq"
                    className="text-xs font-medium text-zinc-400 transition-colors hover:text-foreground"
                  >
                    Popular Questions
                  </Link>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div
                  className="sources-markdown prose prose-sm prose-zinc max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: ragHtml }}
                />
              </div>
            </div>
          </div>

          <DragDivider
            containerRef={panelsRef}
            sourcesRef={sourcesRef}
            chatRef={chatAreaRef}
            onDragEnd={setPanelRatio}
          />

          <div
            ref={chatAreaRef}
            className="min-h-0 overflow-hidden"
            style={{ flex: `${1 - panelRatio} 0 0` }}
          >
            <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
              <h1 className="mb-4 text-lg font-bold text-foreground lg:text-xl">
                {question}
              </h1>
              <TypewriterRenderer markdown={answerMarkdown} />
            </div>
          </div>
        </div>

        {/* ── Mobile: tab content ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {isAnonymous && <AnonymousBanner />}

          {activeTab === "sources" ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div
                className="sources-markdown prose prose-sm prose-zinc max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: ragHtml }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <h1 className="mb-4 text-lg font-bold text-foreground">
                {question}
              </h1>
              <TypewriterRenderer markdown={answerMarkdown} />
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        <SeoComposer
          onFocus={handleComposerFocus}
          onSubmit={handleFollowUp}
          disabled={seeding}
          isAnonymous={isAnonymous}
        />
      </div>

      {/* ── Login modal ── */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          seoSlug={slug}
        />
      )}
    </div>
  );
}

// ── Simplified composer for SEO pages ────────────────────────────────

interface SeoComposerProps {
  onFocus: () => void;
  onSubmit: (content: string) => void;
  disabled: boolean;
  isAnonymous: boolean;
}

function SeoComposer({ onFocus, onSubmit, disabled, isAnonymous }: SeoComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnonymous) {
      onFocus();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={isAnonymous ? onFocus : undefined}
          placeholder={
            isAnonymous
              ? "Sign up to ask a follow-up…"
              : disabled
                ? "Starting conversation…"
                : "Ask a follow-up question…"
          }
          disabled={disabled}
          readOnly={isAnonymous}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={disabled || (!value.trim() && !isAnonymous)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          aria-label="Send"
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
              d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
