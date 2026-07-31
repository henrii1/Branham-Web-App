"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthGate";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ReferencePopover } from "@/components/chat/ReferencePopover";
import { LoginModal } from "@/components/chat/LoginModal";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";
import { forkConversationFromShare } from "@/lib/chat/forkFromShare";
import type { Message } from "@/lib/chat/types";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface SharePageShellProps {
  conversationId: string;
  shareHash: string;
  title: string | null;
  messages: Message[];
  isOwner: boolean;
  language: string;
  strings: ChatStrings;
}

export function SharePageShell({
  conversationId,
  shareHash,
  title,
  messages,
  isOwner,
  language,
  strings,
}: SharePageShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [continueError, setContinueError] = useState(false);

  // Stashes the pending action (continue with no message, or continue
  // AND send this follow-up) so ChatShell's init effect can pick it up
  // once the user lands back on /chat after logging in — same handoff
  // pattern the SEO pages use for anonymous->logged-in follow-ups.
  const requireLogin = useCallback(
    (query: string | null) => {
      localStorage.setItem(
        "pending_share_followup",
        JSON.stringify({ shareHash, query, language }),
      );
      setShowLoginModal(true);
    },
    [shareHash, language],
  );

  const continueConversation = useCallback(
    async (query: string | null) => {
      if (!user) {
        requireLogin(query);
        return;
      }

      // Owner: no fork needed, no round-trip to figure out the target —
      // it's already known from the server-rendered isOwner prop.
      if (isOwner) {
        if (query) {
          localStorage.setItem(
            "seo_followup",
            JSON.stringify({ conversationId, query, language }),
          );
        }
        router.push(`/chat/${conversationId}`);
        return;
      }

      setWorking(true);
      setContinueError(false);
      try {
        const newConversationId = await forkConversationFromShare(shareHash, user.id);
        if (!newConversationId) {
          setContinueError(true);
          return;
        }
        if (query) {
          localStorage.setItem(
            "seo_followup",
            JSON.stringify({ conversationId: newConversationId, query, language }),
          );
        }
        router.push(`/chat/${newConversationId}`);
      } catch (err) {
        console.error("Failed to continue shared conversation:", err);
        setContinueError(true);
      } finally {
        setWorking(false);
      }
    },
    [user, isOwner, conversationId, shareHash, language, router, requireLogin],
  );

  const handleComposerFocus = useCallback(() => {
    if (!user) requireLogin(null);
  }, [user, requireLogin]);

  const handleComposerSubmit = useCallback(
    (content: string) => {
      void continueConversation(content);
    },
    [continueConversation],
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-zinc-200 bg-[var(--surface-base)] px-4 py-3 dark:border-zinc-800">
        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareContinueGuidance}
        </p>
        {title && (
          <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {continueError && (
        <p className="px-4 pt-2 text-center text-sm text-red-600 dark:text-red-400">
          {strings.shareForkError}
        </p>
      )}

      <ShareComposer
        onFocus={handleComposerFocus}
        onSubmit={handleComposerSubmit}
        disabled={working}
        isAnonymous={!user}
        strings={strings}
      />

      <ReferencePopover />
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
}

// ── Simplified composer for the public share page — mirrors SeoShell's
// SeoComposer (same anonymous-gating + voice-input pattern), scoped here
// since it's specific to this page's continue/fork flow. ──────────────

interface ShareComposerProps {
  onFocus: () => void;
  onSubmit: (content: string) => void;
  disabled: boolean;
  isAnonymous: boolean;
  strings: ChatStrings;
}

function ShareComposer({ onFocus, onSubmit, disabled, isAnonymous, strings }: ShareComposerProps) {
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

  const { isSupported, isRecording, startRecording, stopRecording } = useVoiceInput({
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
      <div className="mx-auto flex max-w-3xl items-center gap-2">
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
              ? strings.shareFollowUpPlaceholderAnonymous
              : disabled
                ? strings.shareFollowUpPreparing
                : strings.shareFollowUpPlaceholder
          }
          disabled={disabled}
          readOnly={isAnonymous}
          className={`flex-1 rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-400 disabled:opacity-50 ${
            isRecording
              ? "border-red-400 bg-red-50 focus:border-red-400 dark:bg-red-950/20 dark:border-red-600"
              : "border-zinc-200 focus:border-zinc-400 focus:bg-[var(--surface-base)] dark:border-zinc-700 dark:focus:border-zinc-500"
          }`}
        />

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
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
