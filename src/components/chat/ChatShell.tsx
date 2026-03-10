"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthGate";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { generateId } from "@/lib/utils/ids";
import { processSSEStream } from "@/lib/sse/parser";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";
import { stripParagraphLetterSuffixes } from "@/lib/markdown/citations";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import {
  fetchConversations,
  fetchConversation,
  fetchMessages,
  fetchLatestRag,
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
  renameConversation,
  deleteConversation,
  fetchSeoPageClient,
} from "@/lib/db/queries";
import type {
  Message,
  RagData,
  StreamingStatus,
  Conversation,
} from "@/lib/chat/types";
import type { MessageRow, RagRow } from "@/lib/db/queries";

import { ConversationSidebar } from "./ConversationSidebar";
import { SourcesPanel } from "./SourcesPanel";
import { ChatPanel } from "./ChatPanel";
import { Composer } from "./Composer";
import { DragDivider } from "./DragDivider";
import { AnonymousBanner } from "./AnonymousBanner";
import { LoginModal } from "./LoginModal";
import { WelcomeEmailTrigger } from "./WelcomeEmailTrigger";
import { SidebarRail } from "./SidebarRail";

const DEFAULT_PANEL_RATIO = 0.4;
const MAX_TITLE_LENGTH = 50;

function generateTitle(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…";
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
  };
}

function rowToRagData(row: RagRow): RagData {
  return {
    retrievalQuery: row.retrieval_query,
    ragContext: row.rag_context,
    retrieval: Array.isArray(row.retrieval_metadata)
      ? row.retrieval_metadata
      : [],
  };
}

function rowToConversation(
  row: import("@/lib/db/queries").ConversationRow,
): Conversation {
  return {
    id: row.id,
    title: row.title,
    conversationSummary: row.conversation_summary,
    updatedAt: row.updated_at,
  };
}

interface ChatShellProps {
  initialConversationId?: string;
  triggerWelcomeEmail?: boolean;
}

export function ChatShell({
  initialConversationId,
  triggerWelcomeEmail = false,
}: ChatShellProps) {
  const { user, isLoading: authLoading } = useAuth();
  const isAnonymous = !user;

  // ── Conversation state ──────────────────────────────────────────────
  const [conversationId, setConversationId] = useState(
    () => initialConversationId ?? generateId(),
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [ragData, setRagData] = useState<RagData | null>(null);
  const [streamingStatus, setStreamingStatus] =
    useState<StreamingStatus>("idle");
  const [streamBuffer, setStreamBuffer] = useState("");
  const [conversationSummary, setConversationSummary] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // ── Persistence state (logged-in only) ──────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationExists, setConversationExists] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "sources">("chat");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [panelRatio, setPanelRatio] = useState(DEFAULT_PANEL_RATIO);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────
  const panelsRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRagRef = useRef<RagData | null>(null);
  const dbReadyRef = useRef<Promise<void>>(Promise.resolve());
  const loadIdRef = useRef(0);
  const initialLoadDone = useRef(false);
  const pendingFollowUpRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Load conversations list (sidebar) ───────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConversationsLoading(true);
    try {
      const rows = await fetchConversations(user.id);
      setConversations(rows.map(rowToConversation));
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  // ── Load a specific conversation ────────────────────────────────────
  const loadConversation = useCallback(
    async (id: string) => {
      if (!user) return;
      const thisLoadId = ++loadIdRef.current;
      setConversationLoading(true);
      setError(null);

      try {
        const [conv, msgs, rag] = await Promise.all([
          fetchConversation(id),
          fetchMessages(id),
          fetchLatestRag(id),
        ]);

        if (loadIdRef.current !== thisLoadId) return;

        if (!conv) {
          setError("Conversation not found.");
          setConversationLoading(false);
          return;
        }

        setConversationId(id);
        setMessages(msgs.map(rowToMessage));
        setRagData(rag ? rowToRagData(rag) : null);
        setConversationSummary(conv.conversation_summary);
        setConversationExists(true);
        setStreamBuffer("");
        setStreamingStatus("idle");
        setActiveTab(rag ? "sources" : "chat");
      } catch (err) {
        if (loadIdRef.current !== thisLoadId) return;
        console.error("Failed to load conversation:", err);
        setError("Failed to load conversation. Please try again.");
      } finally {
        if (loadIdRef.current === thisLoadId) {
          setConversationLoading(false);
        }
      }
    },
    [user],
  );

  // ── Initial data load (runs once after auth resolves) ───────────────
  useEffect(() => {
    if (authLoading || !user || initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadConversations();

    const pendingSlug = localStorage.getItem("pending_seo_slug");
    if (pendingSlug && !initialConversationId) {
      localStorage.removeItem("pending_seo_slug");
      (async () => {
        try {
          const seoData = await fetchSeoPageClient(pendingSlug);
          if (!seoData) return;

          const convId = generateId();
          const userMsgId = generateId();
          const assistantMsgId = generateId();

          await createConversation(convId, user.id, seoData.question);
          await saveMessage(userMsgId, convId, user.id, "user", seoData.question);
          await saveMessage(assistantMsgId, convId, user.id, "assistant", seoData.answer_markdown);
          const processedSeoRag = postprocessRag(seoData.rag_context);

          await Promise.all([
            upsertRag(convId, processedSeoRag, seoData.question),
            updateConversationAfterTurn(convId, seoData.conversation_summary),
          ]);

          setConversationId(convId);
          setConversationExists(true);
          setMessages([
            { id: userMsgId, role: "user", content: seoData.question, createdAt: new Date().toISOString() },
            { id: assistantMsgId, role: "assistant", content: seoData.answer_markdown, createdAt: new Date().toISOString() },
          ]);
          setRagData({
            retrievalQuery: seoData.question,
            ragContext: processedSeoRag,
            retrieval: [],
          });
          setConversationSummary(seoData.conversation_summary);
          window.history.replaceState(null, "", `/chat/${convId}`);
          loadConversations();
        } catch (err) {
          console.error("Failed to seed conversation from SEO:", err);
        }
      })();
    } else if (initialConversationId) {
      const raw = localStorage.getItem("seo_followup");
      if (raw) {
        localStorage.removeItem("seo_followup");
        try {
          const parsed = JSON.parse(raw);
          if (parsed.conversationId === initialConversationId && parsed.query) {
            pendingFollowUpRef.current = parsed.query;
          }
        } catch { /* malformed JSON — ignore */ }
      }
      loadConversation(initialConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // ── Auto-send pending SEO follow-up after conversation loads ─────────
  useEffect(() => {
    if (conversationLoading || !conversationExists || !pendingFollowUpRef.current) return;
    const query = pendingFollowUpRef.current;
    pendingFollowUpRef.current = null;
    handleSendMessage(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationLoading, conversationExists]);

  // ── Select conversation from sidebar ────────────────────────────────
  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (id === conversationId && conversationExists) return;
      abortRef.current?.abort();
      streamRagRef.current = null;
      window.history.replaceState(null, "", `/chat/${id}`);
      await loadConversation(id);
    },
    [conversationId, conversationExists, loadConversation],
  );

  // ── Send message ────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (content: string) => {
      const hasExistingUserMessage = messages.some((m) => m.role === "user");
      if (isAnonymous && hasExistingUserMessage) {
        setShowLoginModal(true);
        return;
      }

      const historyWindow =
        messages.length > 0
          ? messages.map((m) => ({ role: m.role, content: m.content }))
          : undefined;

      const requestBody: Record<string, unknown> = {
        conversation_id: conversationId,
        query: content,
        user_language: "en",
      };
      if (conversationSummary) {
        requestBody.conversation_summary = conversationSummary;
      }
      if (historyWindow) {
        requestBody.history_window = historyWindow;
      }

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setStreamingStatus("connecting");
      setStreamBuffer("");
      setRagData(null);
      setError(null);
      streamRagRef.current = null;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // ── Persist user message (logged-in only, fire-and-forget) ──────
      const currentConvId = conversationId;
      const currentUser = user;
      const isNew = !conversationExists;

      if (currentUser) {
        dbReadyRef.current = (async () => {
          try {
            if (isNew) {
              await createConversation(
                currentConvId,
                currentUser.id,
                generateTitle(content),
              );
              setConversationExists(true);
              window.history.replaceState(
                null,
                "",
                `/chat/${currentConvId}`,
              );
            }
            await saveMessage(
              userMessage.id,
              currentConvId,
              currentUser.id,
              "user",
              content,
            );
          } catch (err) {
            console.error("Failed to persist user message:", err);
          }
        })();
      }

      // ── Stream response ─────────────────────────────────────────────
      let buffer = "";
      let firstDelta = true;
      let receivedDone = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(
            (errBody as Record<string, string>).error ||
              `Request failed (${response.status})`,
          );
        }

        if (!response.body) {
          throw new Error("No response stream received");
        }

        const reader = response.body.getReader();

        await processSSEStream(
          reader,
          (event) => {
            switch (event.type) {
              case "start":
                break;

              case "rag": {
                const rag: RagData = {
                  retrievalQuery: event.retrievalQuery,
                  ragContext: event.ragContext,
                  retrieval: event.retrieval as unknown[],
                };
                streamRagRef.current = rag;
                setRagData(rag);
                setStreamingStatus("rag_received");
                setActiveTab("sources");
                break;
              }

              case "delta": {
                buffer += event.text;
                setStreamBuffer(stripAnswerPrefix(buffer));
                if (firstDelta) {
                  firstDelta = false;
                  setStreamingStatus("streaming");
                  setActiveTab("chat");
                }
                break;
              }

              case "final": {
                const finalAnswer = stripParagraphLetterSuffixes(
                  stripAnswerPrefix(event.answer),
                );

                if (event.mode === "error") {
                  setError(finalAnswer || "An error occurred");
                  setStreamBuffer("");
                  setStreamingStatus("error");
                  break;
                }

                const assistantMessage: Message = {
                  id: generateId(),
                  role: "assistant",
                  content: finalAnswer,
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamBuffer("");
                setStreamingStatus("complete");

                if (event.conversationSummary) {
                  setConversationSummary(event.conversationSummary);
                }

                // ── Persist assistant response (logged-in only) ───────
                if (currentUser) {
                  const currentRag = streamRagRef.current;
                  const summary = event.conversationSummary;
                  const apiTitle = event.querySummary;
                  const shouldUpdateTitle = isNew && !!apiTitle;

                  (async () => {
                    try {
                      await dbReadyRef.current;
                      await Promise.all([
                        saveMessage(
                          assistantMessage.id,
                          currentConvId,
                          currentUser.id,
                          "assistant",
                          finalAnswer,
                        ),
                        currentRag
                          ? upsertRag(
                              currentConvId,
                              postprocessRag(currentRag.ragContext),
                              currentRag.retrievalQuery,
                              currentRag.retrieval,
                            )
                          : Promise.resolve(),
                        updateConversationAfterTurn(
                          currentConvId,
                          summary ?? null,
                        ),
                        shouldUpdateTitle
                          ? renameConversation(currentConvId, apiTitle)
                          : Promise.resolve(),
                      ]);
                      loadConversations();
                    } catch (err) {
                      console.error(
                        "Failed to persist assistant response:",
                        err,
                      );
                    }
                  })();
                }
                break;
              }

              case "done":
                receivedDone = true;
                setStreamingStatus("idle");
                break;

              case "error":
                setError(event.answer || "An error occurred");
                setStreamBuffer("");
                setStreamingStatus("error");
                break;
            }
          },
          controller.signal,
        );

        if (!controller.signal.aborted && !receivedDone) {
          setStreamingStatus((prev) =>
            prev === "complete" || prev === "streaming" ? "idle" : prev,
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        setStreamBuffer("");
        setStreamingStatus("error");
      }
    },
    [
      isAnonymous,
      user,
      messages,
      conversationId,
      conversationSummary,
      conversationExists,
      loadConversations,
    ],
  );

  // ── New conversation ────────────────────────────────────────────────
  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setConversationId(generateId());
    setMessages([]);
    setRagData(null);
    setStreamingStatus("idle");
    setStreamBuffer("");
    setConversationSummary(null);
    setError(null);
    setActiveTab("chat");
    setConversationExists(false);
    setConversationLoading(false);
    streamRagRef.current = null;
    dbReadyRef.current = Promise.resolve();
    window.history.replaceState(null, "", "/chat");
  }, []);

  // ── Rename conversation ──────────────────────────────────────────────
  const handleRenameConversation = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await renameConversation(id, newTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
        );
      } catch (err) {
        console.error("Failed to rename conversation:", err);
      }
    },
    [],
  );

  // ── Delete conversation ─────────────────────────────────────────────
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (id === conversationId) {
          handleNewConversation();
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [conversationId, handleNewConversation],
  );

  // ── Auth loading skeleton ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh bg-background">
      <WelcomeEmailTrigger enabled={triggerWelcomeEmail} />

      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden flex-shrink-0 border-r border-zinc-200 transition-[width] duration-200 lg:block dark:border-zinc-800 ${
          sidebarCollapsed ? "w-16" : "w-72"
        }`}
      >
        {sidebarCollapsed ? (
          <SidebarRail
            user={user ?? null}
            onExpand={() => setSidebarCollapsed(false)}
            onNewChat={handleNewConversation}
          />
        ) : (
          <ConversationSidebar
            user={user ?? null}
            conversations={conversations}
            activeConversationId={conversationId}
            isLoading={conversationsLoading}
            onNewChat={handleNewConversation}
            onSelectConversation={handleSelectConversation}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onCollapse={() => setSidebarCollapsed(true)}
          />
        )}
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
              activeConversationId={conversationId}
              isLoading={conversationsLoading}
              onNewChat={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onRenameConversation={handleRenameConversation}
              onDeleteConversation={handleDeleteConversation}
              onClose={() => setMobileDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Mobile header ── */}
        <MobileHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onMenuOpen={() => setMobileDrawerOpen(true)}
          onNewChat={handleNewConversation}
          hasRag={!!ragData}
        />

        {/* ── Anonymous banner (desktop only) ── */}
        {isAnonymous && (
          <div className="hidden lg:block">
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
            className="min-h-0 overflow-hidden border-b border-zinc-200 dark:border-zinc-800"
            style={{ flex: `${panelRatio} 0 0` }}
          >
            <SourcesPanel ragData={ragData} streamingStatus={streamingStatus} />
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
            <ChatPanel
              messages={messages}
              streamingStatus={streamingStatus}
              streamBuffer={streamBuffer}
              error={error}
              isLoading={conversationLoading}
            />
          </div>
        </div>

        {/* ── Mobile: tab content ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {isAnonymous && <AnonymousBanner />}

          <div className="flex-1 overflow-hidden">
            {activeTab === "sources" ? (
              <SourcesPanel
                ragData={ragData}
                streamingStatus={streamingStatus}
              />
            ) : (
              <ChatPanel
                messages={messages}
                streamingStatus={streamingStatus}
                streamBuffer={streamBuffer}
                error={error}
                isLoading={conversationLoading}
              />
            )}
          </div>
        </div>

        {/* ── Composer (always visible) ── */}
        <Composer
          onSend={handleSendMessage}
          disabled={false}
          streamingStatus={streamingStatus}
        />
      </div>

      {/* ── Login modal ── */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}

// ── Mobile header with tabs ──────────────────────────────────────────

interface MobileHeaderProps {
  activeTab: "chat" | "sources";
  setActiveTab: (tab: "chat" | "sources") => void;
  onMenuOpen: () => void;
  onNewChat: () => void;
  hasRag: boolean;
}

function MobileHeader({
  activeTab,
  setActiveTab,
  onMenuOpen,
  onNewChat,
  hasRag,
}: MobileHeaderProps) {
  return (
    <header className="flex flex-col border-b border-zinc-200 bg-[var(--surface-base)] lg:hidden dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuOpen}
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
          <BrandLogo href="/chat" size={30} nameClassName="text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/faq"
            className="hidden text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 sm:inline dark:hover:text-zinc-200"
          >
            Popular Questions
          </Link>
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="New chat"
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
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <nav
        className="flex border-t border-zinc-100 dark:border-zinc-800"
        role="tablist"
        aria-label="Chat panels"
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
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sources"}
          onClick={() => setActiveTab("sources")}
          className={`relative flex-1 py-2 text-center text-xs font-medium transition-colors ${
            activeTab === "sources"
              ? "border-b-2 border-zinc-900 text-foreground dark:border-zinc-100"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          Sources
          {hasRag && activeTab !== "sources" && (
            <span className="absolute top-1.5 ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          )}
        </button>
      </nav>
    </header>
  );
}
