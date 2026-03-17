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
const MOBILE_ACTIVE_TAB_KEY = "branham-mobile-active-tab";

function getIsMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function getStoredMobileTab(): "chat" | "sources" {
  if (typeof window === "undefined") return "chat";
  const storedTab = window.sessionStorage.getItem(MOBILE_ACTIVE_TAB_KEY);
  return storedTab === "chat" || storedTab === "sources" ? storedTab : "chat";
}

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
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);

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
  const [activeTab, setActiveTab] = useState<"chat" | "sources">(
    getStoredMobileTab,
  );
  const [chatReady, setChatReady] = useState(false);
  const [sourcesReady, setSourcesReady] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [panelRatio, setPanelRatio] = useState(DEFAULT_PANEL_RATIO);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────
  const panelsRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeTabRef = useRef<"chat" | "sources">(activeTab);
  const streamRagRef = useRef<RagData | null>(null);
  const dbReadyRef = useRef<Promise<void>>(Promise.resolve());
  const loadIdRef = useRef(0);
  const initialLoadDone = useRef(false);
  const pendingFollowUpRef = useRef<string | null>(null);
  // ── Swipe-to-switch-tab refs ────────────────────────────────────────
  // Direct ref to the 200%-wide slider div — lets us animate via DOM instead
  // of React state, so zero re-renders happen while the finger is moving.
  const mobileSliderRef = useRef<HTMLDivElement>(null);
  // Skip the animated transition on the very first mount (just position it).
  const isInitialSliderMount = useRef(true);
  // Prevent the activeTab useEffect from re-running a CSS transition that was
  // already started imperatively in handleSwipeTouchEnd (would cause a hang).
  const skipNextSliderSync = useRef(false);
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeIsHorizontal = useRef<boolean | null>(null);
  const swipeDragX = useRef(0);

  // ── Animated mobile drawer refs ─────────────────────────────────────
  // drawerShouldRender keeps the DOM alive during the close animation
  // so the CSS transition plays before the element is unmounted.
  const [drawerShouldRender, setDrawerShouldRender] = useState(false);
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerBackdropRef = useRef<HTMLDivElement>(null);
  const drawerTouchStartX = useRef<number | null>(null);
  const drawerDragX = useRef(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const applyViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
      if (!matches) {
        setChatReady(false);
        setSourcesReady(false);
        return;
      }

      const storedTab = getStoredMobileTab();
      activeTabRef.current = storedTab;
      setActiveTab(storedTab);
    };

    applyViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (typeof window === "undefined" || !isMobileViewport) return;
    window.sessionStorage.setItem(MOBILE_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab, isMobileViewport]);

  // ── Sync mobile slider position imperatively when activeTab changes ──
  // This runs after tab-button taps, sidebar nav, and post-swipe state updates.
  // On the very first mount we skip the transition so the panel starts at the
  // correct position immediately (no animation flash on load).
  // After a swipe commit we skip it entirely — the imperative animation already
  // ran in handleSwipeTouchEnd, and re-setting the transform mid-flight would
  // cause a visible stutter/hang on iOS Safari.
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

  // Open: mount → next paint → CSS transition slides in.
  const openMobileDrawer = useCallback(() => {
    if (drawerCloseTimerRef.current) {
      clearTimeout(drawerCloseTimerRef.current);
      drawerCloseTimerRef.current = null;
    }
    setDrawerShouldRender(true);
    // Two rAFs ensure the element is painted at translateX(-100%) before
    // we flip mobileDrawerOpen → true (which triggers the CSS transition).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setMobileDrawerOpen(true)),
    );
  }, []);

  // Close: CSS transition plays while still mounted, then unmount.
  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
    drawerCloseTimerRef.current = setTimeout(() => {
      setDrawerShouldRender(false);
      drawerCloseTimerRef.current = null;
    }, 260);
  }, []);

  const handleTabChange = useCallback((tab: "chat" | "sources") => {
    activeTabRef.current = tab;
    setActiveTab(tab);
    if (tab === "chat") {
      setChatReady(false);
      return;
    }
    setSourcesReady(false);
  }, []);

  // ── Animated swipe-to-switch-tab — fully imperative, zero re-renders ──
  // We drive the slider DOM node directly during the gesture so React's
  // reconciler is never involved until the swipe commits (tab change).

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeTouchStart.current = { x: t.clientX, y: t.clientY };
    swipeIsHorizontal.current = null;
    swipeDragX.current = 0;
    // Disable CSS transition while the finger is down — must be instant.
    const el = mobileSliderRef.current;
    if (el) el.style.transition = "none";
  }, []);

  const handleSwipeTouchMove = useCallback((e: React.TouchEvent) => {
    const el = mobileSliderRef.current;
    if (!swipeTouchStart.current || !el) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeTouchStart.current.x;
    const dy = t.clientY - swipeTouchStart.current.y;

    // Lock gesture direction on first significant movement.
    if (swipeIsHorizontal.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        swipeIsHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!swipeIsHorizontal.current) return; // vertical — ignore

    // Clamp: Chat only swipes left (→ Sources), Sources only swipes right (→ Chat).
    const clamped =
      activeTabRef.current === "chat" ? Math.min(0, dx) : Math.max(0, dx);
    swipeDragX.current = clamped;

    // Direct DOM write — the only thing that moves the slider during drag.
    const base = activeTabRef.current === "sources" ? "-50%" : "0%";
    el.style.transform = `translateX(calc(${base} + ${clamped}px))`;
  }, []);

  // Also fires on touchcancel so a cancelled gesture snaps back cleanly.
  const handleSwipeTouchEnd = useCallback(() => {
    const el = mobileSliderRef.current;
    const startX = swipeTouchStart.current?.x ?? Infinity;
    swipeTouchStart.current = null;
    const dx = swipeDragX.current;
    swipeDragX.current = 0;
    const wasHorizontal = swipeIsHorizontal.current === true;
    swipeIsHorizontal.current = null;

    if (!el) return;

    // Re-enable transition for the snap/commit animation.
    const transition = "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transition = transition;

    // Right-swipe from the left edge of the chat panel opens the drawer.
    if (wasHorizontal && dx > 60 && startX < 44 && activeTabRef.current === "chat") {
      el.style.transform = "translateX(0%)";
      openMobileDrawer();
      return;
    }

    if (!wasHorizontal || Math.abs(dx) <= 60) {
      // Not a swipe, or too short — snap back to current tab.
      el.style.transform =
        activeTabRef.current === "sources" ? "translateX(-50%)" : "translateX(0%)";
      return;
    }

    if (dx < 0 && activeTabRef.current === "chat") {
      // Committed swipe left → Sources.
      el.style.transform = "translateX(-50%)";
      skipNextSliderSync.current = true;
      handleTabChange("sources");
    } else if (dx > 0 && activeTabRef.current === "sources") {
      // Committed swipe right → Chat.
      el.style.transform = "translateX(0%)";
      skipNextSliderSync.current = true;
      handleTabChange("chat");
    } else {
      el.style.transform =
        activeTabRef.current === "sources" ? "translateX(-50%)" : "translateX(0%)";
    }
  }, [handleTabChange]);

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
    const clamped = Math.min(0, dx); // only leftward drag (closing)
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
      // Committed close — animate out, then let closeMobileDrawer schedule unmount.
      el.style.transform = "translateX(-100%)";
      if (bd) { bd.style.transition = "opacity 0.25s"; bd.style.opacity = "0"; }
      closeMobileDrawer();
    } else {
      // Snap back open.
      el.style.transform = "translateX(0)";
      if (bd) { bd.style.transition = "opacity 0.25s"; bd.style.opacity = "0.4"; }
    }
  }, [closeMobileDrawer]);

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
        setChatReady(false);
        setSourcesReady(false);
        const nextTab = isMobileViewport
          ? activeTabRef.current
          : rag
            ? "sources"
            : "chat";
        setActiveTab(nextTab);
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
    [isMobileViewport, user],
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
          setChatReady(false);
          setSourcesReady(false);
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
      setChatReady(false);
      setSourcesReady(false);
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
                if (isMobileViewport) {
                  if (activeTabRef.current !== "sources") {
                    setSourcesReady(true);
                  }
                } else {
                  setActiveTab("sources");
                }
                break;
              }

              case "delta": {
                buffer += event.text;
                setStreamBuffer(stripAnswerPrefix(buffer));
                if (firstDelta) {
                  firstDelta = false;
                  setStreamingStatus("streaming");
                  if (isMobileViewport) {
                    // Only show "Chat ready" badge if user is NOT already on chat.
                    // Do NOT clear sourcesReady here — both notifications can coexist.
                    if (activeTabRef.current !== "chat") {
                      setChatReady(true);
                    }
                  } else {
                    setActiveTab("chat");
                  }
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
      isMobileViewport,
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
    setChatReady(false);
    setSourcesReady(false);
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
      {/* Conditionally mounted; drawerShouldRender stays true during the
          close animation so the CSS transition finishes before unmounting. */}
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
              activeConversationId={conversationId}
              isLoading={conversationsLoading}
              onNewChat={handleNewConversation}
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
        <MobileHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onMenuOpen={openMobileDrawer}
          onNewChat={handleNewConversation}
          hasRag={!!ragData}
          chatReady={chatReady}
          sourcesReady={sourcesReady}
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

        {/* ── Mobile: sliding tab panels ── */}
        {/* Both panels sit side-by-side in a 200%-wide inner div.           translateX(0%)  → Chat visible                                    translateX(-50%) → Sources visible (−50% of 200% = −100vw)       During a drag, dragX shifts the position live so panels glide.    touch-action:pan-y lets the browser handle vertical scroll inside     each panel without interfering with our horizontal swipe detection. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {isAnonymous && <AnonymousBanner />}

          <div className="relative flex-1 overflow-hidden">
            {/* transform/transition are managed imperatively via mobileSliderRef */}
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
              {/* Chat — 50% of 200% inner = 100% of viewport */}
              <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
                <ChatPanel
                  messages={messages}
                  streamingStatus={streamingStatus}
                  streamBuffer={streamBuffer}
                  error={error}
                  isLoading={conversationLoading}
                />
              </div>
              {/* Sources — 50% of 200% inner = 100% of viewport */}
              <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>
                <SourcesPanel
                  ragData={ragData}
                  streamingStatus={streamingStatus}
                />
              </div>
            </div>
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
  onTabChange: (tab: "chat" | "sources") => void;
  onMenuOpen: () => void;
  onNewChat: () => void;
  hasRag: boolean;
  chatReady: boolean;
  sourcesReady: boolean;
}

function MobileHeader({
  activeTab,
  onTabChange,
  onMenuOpen,
  onNewChat,
  hasRag,
  chatReady,
  sourcesReady,
}: MobileHeaderProps) {
  // Show notification for the tab that has new content but is not currently active.
  const sourcesNotif = activeTab !== "sources" && sourcesReady;
  const chatNotif = activeTab !== "chat" && chatReady;

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
        {/* Chat tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "chat"}
          onClick={() => onTabChange("chat")}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
            activeTab === "chat"
              ? "border-b-2 border-zinc-900 text-foreground dark:border-zinc-100"
              : chatReady
                ? "mobile-ready-tab border-b-2 border-blue-400 text-blue-700 dark:border-blue-500 dark:text-blue-300"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          {/* Chat icon */}
          <svg
            className={`h-3.5 w-3.5 shrink-0 ${chatReady ? "mobile-ready-icon" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={activeTab === "chat" ? 2 : 1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
          <span>Chat</span>
          {/* "New" badge when chat result just arrived */}
          {chatNotif && (
            <span className="mobile-ready-badge inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm dark:bg-blue-500">
              NEW
            </span>
          )}
        </button>

        {/* Sources tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sources"}
          onClick={() => onTabChange("sources")}
          className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
            activeTab === "sources"
              ? "border-b-2 border-zinc-900 text-foreground dark:border-zinc-100"
              : sourcesReady
                ? "mobile-ready-tab border-b-2 border-blue-400 text-blue-700 dark:border-blue-500 dark:text-blue-300"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          {/* Sources / book icon — swells when ready */}
          <span className={`relative shrink-0 ${sourcesReady ? "mobile-ready-icon" : ""}`}>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={activeTab === "sources" ? 2 : 1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
            {/* Persistent green dot when rag is available but not yet "ready-notif" */}
            {hasRag && !sourcesReady && activeTab !== "sources" && (
              <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </span>
          <span>Sources</span>
          {/* "NEW" badge when sources just arrived */}
          {sourcesNotif && (
            <span className="mobile-ready-badge inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm dark:bg-blue-500">
              NEW
            </span>
          )}
        </button>
      </nav>

      {/* Notification strip — shown when content is ready on the other tab */}
      {(sourcesNotif || chatNotif) && (
        <div
          className="mobile-ready-notif flex items-center gap-2 border-t border-blue-100 bg-blue-50 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/30"
          aria-live="polite"
        >
          {/* Animated pulse dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
          </span>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
            {sourcesNotif && chatNotif ? (
              <>Sources &amp; answer ready — swipe or tap a tab</>
            ) : sourcesNotif ? (
              <>
                Sources ready — swipe
                {/* Animated left-nudge chevron */}
                <svg
                  className="swipe-hint-left h-3 w-3 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                or tap Sources
              </>
            ) : (
              <>
                Answer ready — swipe
                {/* Animated right-nudge chevron */}
                <svg
                  className="swipe-hint-right h-3 w-3 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                or tap Chat
              </>
            )}
          </p>
        </div>
      )}
    </header>
  );
}
