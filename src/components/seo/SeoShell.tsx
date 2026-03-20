"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthGate";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { generateId } from "@/lib/utils/ids";
import {
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
  fetchConversations,
  renameConversation,
  deleteConversation,
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
import { SidebarRail } from "@/components/chat/SidebarRail";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";

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
  const [activeTab, setActiveTab] = useState<"chat" | "sources">(() => {
    if (typeof window === "undefined") return "chat";
    const stored = window.sessionStorage.getItem("branham-mobile-active-tab");
    return stored === "chat" || stored === "sources" ? stored : "chat";
  });
  const [panelRatio, setPanelRatio] = useState(DEFAULT_PANEL_RATIO);
  const [seeding, setSeeding] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drawerShouldRender, setDrawerShouldRender] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const panelsRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  // Imperative slider ref — animated via direct DOM writes, not React state.
  const mobileSliderRef = useRef<HTMLDivElement>(null);
  const isInitialSliderMount = useRef(true);
  const skipNextSliderSync = useRef(false);
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeIsHorizontal = useRef<boolean | null>(null);
  const swipeDragX = useRef(0);
  const activeTabRef = useRef<"chat" | "sources">(activeTab);

  // ── Animated mobile drawer refs ─────────────────────────────────────
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerBackdropRef = useRef<HTMLDivElement>(null);
  const drawerTouchStartX = useRef<number | null>(null);
  const drawerDragX = useRef(0);

  const processedRag = postprocessRag(ragContext);
  const ragHtml = renderMarkdown(processedRag);

  const loadSidebarConversations = useCallback(async () => {
    if (!user) return;

    setConversationsLoading(true);
    try {
      const rows = await fetchConversations(user.id);
      setConversations(rows.map(rowToConversation));
    } catch (error) {
      console.error(error);
    } finally {
      setConversationsLoading(false);
    }
  }, [user]);

  // ── Load sidebar conversations (logged-in only) ─────────────────────
  useEffect(() => {
    if (!user) return;
    void loadSidebarConversations();
  }, [user, loadSidebarConversations]);

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

  const handleRenameConversation = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await renameConversation(id, newTitle);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === id
              ? { ...conversation, title: newTitle }
              : conversation,
          ),
        );
      } catch (error) {
        console.error("Failed to rename conversation:", error);
      }
    },
    [],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        setConversations((prev) =>
          prev.filter((conversation) => conversation.id !== id),
        );
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    },
    [],
  );

  // Keep activeTabRef in sync and persist to sessionStorage so refresh restores the tab.
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("branham-mobile-active-tab", activeTab);
    }
  }, [activeTab]);

  // Sync slider position imperatively when tab changes (tap or swipe commit).
  // Skip when triggered by a swipe commit — the imperative animation already ran.
  useEffect(() => {
    const el = mobileSliderRef.current;
    if (!el) return;
    if (skipNextSliderSync.current) {
      skipNextSliderSync.current = false;
      return;
    }
    const target = activeTab === "sources" ? "translateX(-50%)" : "translateX(0%)";
    if (isInitialSliderMount.current) {
      isInitialSliderMount.current = false;
      el.style.transition = "none";
      el.style.transform = target;
      return;
    }
    el.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = target;
  }, [activeTab]);

  const openMobileDrawer = useCallback(() => {
    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    setDrawerShouldRender(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setMobileDrawerOpen(true)),
    );
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
    drawerCloseTimerRef.current = setTimeout(() => {
      setDrawerShouldRender(false);
      drawerCloseTimerRef.current = null;
    }, 260);
  }, []);

  // ── Imperative swipe handlers — zero React re-renders during drag ────
  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeTouchStart.current = { x: t.clientX, y: t.clientY };
    swipeIsHorizontal.current = null;
    swipeDragX.current = 0;
    const el = mobileSliderRef.current;
    if (el) el.style.transition = "none";
  }, []);

  const handleSwipeTouchMove = useCallback((e: React.TouchEvent) => {
    const el = mobileSliderRef.current;
    if (!swipeTouchStart.current || !el) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeTouchStart.current.x;
    const dy = t.clientY - swipeTouchStart.current.y;

    if (swipeIsHorizontal.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        swipeIsHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!swipeIsHorizontal.current) return;

    const clamped =
      activeTabRef.current === "chat" ? Math.min(0, dx) : Math.max(0, dx);
    swipeDragX.current = clamped;
    const base = activeTabRef.current === "sources" ? "-50%" : "0%";
    el.style.transform = `translateX(calc(${base} + ${clamped}px))`;
  }, []);

  const handleSwipeTouchEnd = useCallback(() => {
    const el = mobileSliderRef.current;
    const startX = swipeTouchStart.current?.x ?? Infinity;
    swipeTouchStart.current = null;
    const dx = swipeDragX.current;
    swipeDragX.current = 0;
    const wasHorizontal = swipeIsHorizontal.current === true;
    swipeIsHorizontal.current = null;

    if (!el) return;
    el.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)";

    // Right-swipe from the left edge opens the drawer.
    if (wasHorizontal && dx > 60 && startX < 44 && activeTabRef.current === "chat") {
      el.style.transform = "translateX(0%)";
      openMobileDrawer();
      return;
    }

    if (!wasHorizontal || Math.abs(dx) <= 60) {
      el.style.transform =
        activeTabRef.current === "sources" ? "translateX(-50%)" : "translateX(0%)";
      return;
    }

    if (dx < 0 && activeTabRef.current === "chat") {
      el.style.transform = "translateX(-50%)";
      skipNextSliderSync.current = true;
      setActiveTab("sources");
    } else if (dx > 0 && activeTabRef.current === "sources") {
      el.style.transform = "translateX(0%)";
      skipNextSliderSync.current = true;
      setActiveTab("chat");
    } else {
      el.style.transform =
        activeTabRef.current === "sources" ? "translateX(-50%)" : "translateX(0%)";
    }
  }, []);

  // ── Animated drawer touch handlers ──────────────────────────────────
  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    drawerTouchStartX.current = e.touches[0].clientX;
    drawerDragX.current = 0;
    const el = drawerPanelRef.current;
    const bd = drawerBackdropRef.current;
    if (el) el.style.transition = "none";
    if (bd) bd.style.transition = "none";
  }, []);

  const handleDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (drawerTouchStartX.current === null) return;
    const dx = e.touches[0].clientX - drawerTouchStartX.current;
    const clamped = Math.min(0, dx);
    drawerDragX.current = clamped;
    const el = drawerPanelRef.current;
    if (el) el.style.transform = `translateX(${clamped}px)`;
    const bd = drawerBackdropRef.current;
    if (bd) bd.style.opacity = `${Math.max(0, 0.4 * (1 + clamped / 288))}`;
  }, []);

  const handleDrawerTouchEnd = useCallback(() => {
    const dx = drawerDragX.current;
    drawerDragX.current = 0;
    drawerTouchStartX.current = null;
    const el = drawerPanelRef.current;
    const bd = drawerBackdropRef.current;
    if (!el) return;
    el.style.transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
    if (dx < -60) {
      el.style.transform = "translateX(-100%)";
      if (bd) { bd.style.transition = "opacity 0.25s"; bd.style.opacity = "0"; }
      closeMobileDrawer();
    } else {
      el.style.transform = "translateX(0)";
      if (bd) { bd.style.transition = "opacity 0.25s"; bd.style.opacity = "0.4"; }
    }
  }, [closeMobileDrawer]);

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
      <aside
        className={`hidden flex-shrink-0 border-r border-zinc-200 transition-[width] duration-200 lg:block dark:border-zinc-800 ${
          sidebarCollapsed ? "w-16" : "w-72"
        }`}
      >
        {sidebarCollapsed ? (
          <SidebarRail
            user={user ?? null}
            onExpand={() => setSidebarCollapsed(false)}
            onNewChat={handleNewChat}
          />
        ) : (
          <ConversationSidebar
            user={user ?? null}
            conversations={conversations}
            activeConversationId=""
            isLoading={conversationsLoading}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onCollapse={() => setSidebarCollapsed(true)}
          />
        )}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerShouldRender && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ pointerEvents: mobileDrawerOpen ? "auto" : "none" }}
          aria-hidden={!mobileDrawerOpen}
        >
          <div
            ref={drawerBackdropRef}
            className="absolute inset-0 bg-black"
            style={{
              opacity: mobileDrawerOpen ? 0.4 : 0,
              transition: "opacity 0.25s",
            }}
            onClick={closeMobileDrawer}
            aria-hidden="true"
          />
          <div
            ref={drawerPanelRef}
            className="relative z-50 h-full w-72 shadow-xl"
            style={{
              transform: mobileDrawerOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
              touchAction: "pan-y",
            }}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
            onTouchCancel={handleDrawerTouchEnd}
          >
            <ConversationSidebar
              user={user ?? null}
              conversations={conversations}
              activeConversationId=""
              isLoading={conversationsLoading}
              onNewChat={handleNewChat}
              onSelectConversation={handleSelectConversation}
              onRenameConversation={handleRenameConversation}
              onDeleteConversation={handleDeleteConversation}
              onClose={closeMobileDrawer}
            />
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Mobile header ── */}
        <header className="flex flex-col border-b border-zinc-200 bg-[var(--surface-base)] lg:hidden dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={openMobileDrawer}
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

            <BrandLogo href="/" size={30} nameClassName="text-sm" />

            <Link
              href="/faq"
              className="hidden text-xs font-medium text-zinc-500 transition-colors hover:text-foreground sm:inline"
            >
              Popular Questions
            </Link>
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
              Passages
            </button>
          </nav>
        </header>

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
            <div className="flex h-full flex-col bg-[var(--surface-sources)]">
              <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Passages
                </h2>
                <Link
                  href="/faq"
                  className="text-xs font-medium text-zinc-500 transition-colors hover:text-foreground"
                >
                  Popular Questions
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div
                  className="sources-markdown prose prose-sm prose-zinc mx-auto max-w-5xl px-5 py-4 dark:prose-invert xl:max-w-[68rem]"
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
            className="min-h-0 overflow-hidden bg-[var(--surface-chat)]"
            style={{ flex: `${1 - panelRatio} 0 0` }}
          >
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-5 py-6 xl:max-w-[56rem]">
              <h1 className="font-display mb-4 text-2xl text-foreground lg:text-3xl">
                {question}
              </h1>
              <TypewriterRenderer markdown={answerMarkdown} />
            </div>
          </div>
        </div>

        {/* ── Mobile: sliding tab panels ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {isAnonymous && <AnonymousBanner />}

          <div className="relative flex-1 overflow-hidden">
            <div
              ref={mobileSliderRef}
              style={{
                display: "flex",
                width: "200%",
                height: "100%",
                willChange: "transform",
                touchAction: "pan-y",
              }}
              onTouchStart={handleSwipeTouchStart}
              onTouchMove={handleSwipeTouchMove}
              onTouchEnd={handleSwipeTouchEnd}
              onTouchCancel={handleSwipeTouchEnd}
            >
              {/* Answer / Chat panel
                  Outer wrapper is overflow:hidden so the browser skips scroll
                  detection on the slider's direct child — matching ChatShell's
                  panel structure. Scroll happens on the inner div. */}
              <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
                <div className="h-full overflow-y-auto bg-[var(--surface-chat)]">
                  <div className="px-4 py-5">
                    <h1 className="font-display mb-4 text-2xl text-foreground">
                      {question}
                    </h1>
                    <TypewriterRenderer markdown={answerMarkdown} />
                  </div>
                </div>
              </div>
              {/* Sources panel — same outer/inner scroll split */}
              <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
                <div className="h-full overflow-y-auto bg-[var(--surface-sources)]">
                  <div
                    className="sources-markdown prose prose-sm prose-zinc mx-auto max-w-5xl px-5 py-4 dark:prose-invert xl:max-w-[68rem]"
                    dangerouslySetInnerHTML={{ __html: ragHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
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
  const [interimTranscript, setInterimTranscript] = useState("");

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
    setInterimTranscript("");
  };

  const { isSupported, isRecording, startRecording, stopRecording } =
    useVoiceInput({
      onInterimResult: useCallback((transcript: string) => {
        setInterimTranscript(transcript);
      }, []),
      onFinalResult: useCallback((transcript: string) => {
        setInterimTranscript("");
        setValue((prev) => {
          const base = prev.trimEnd();
          return base ? `${base} ${transcript}` : transcript;
        });
      }, []),
    });

  const displayValue = interimTranscript
    ? value.trimEnd()
      ? `${value.trimEnd()} ${interimTranscript}`
      : interimTranscript
    : value;

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-zinc-200 bg-[var(--surface-base)] px-4 py-3 dark:border-zinc-800"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-2 xl:max-w-[56rem]">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            if (isRecording) return;
            setValue(e.target.value);
          }}
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
          className={`flex-1 rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-400 disabled:opacity-50 ${
            isRecording
              ? "border-red-400 bg-red-50 focus:border-red-400 dark:bg-red-950/20 dark:border-red-600"
              : "border-zinc-200 focus:border-zinc-400 focus:bg-[var(--surface-base)] dark:border-zinc-700 dark:focus:border-zinc-500"
          }`}
        />

        {/* Microphone button — hidden when browser doesn't support it */}
        {isSupported && !isAnonymous && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isRecording
                ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
            aria-label={isRecording ? "Stop recording" : "Use voice input"}
          >
            {isRecording ? (
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
            )}
          </button>
        )}

        <button
          type="submit"
          disabled={disabled || (!value.trim() && !isAnonymous)}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
