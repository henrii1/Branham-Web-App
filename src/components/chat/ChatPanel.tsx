"use client";

import type { ReactNode } from "react";

import Image from "next/image";
import type { Message, StreamingStatus, AnswerViewMode } from "@/lib/chat/types";
import { MessageList } from "./MessageList";
import { AnswerViewToggle } from "./AnswerViewToggle";
import logo from "../../../logo.png";

interface ChatPanelProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  error: string | null;
  isLoading?: boolean;
  welcomeDescription: string;
  finalizingText: string;
  mode: AnswerViewMode;
  onModeChange: (mode: AnswerViewMode) => void;
  answerViewFullLabel: string;
  answerViewQuotesLabel: string;
  answerViewQuotesEmpty: string;
  /** Shown under the welcome card on an empty chat (e.g. today's Family Altar). */
  welcomeExtra?: ReactNode;
}

function WelcomeState({ description, extra }: { description: string; extra?: ReactNode }) {
  if (!extra) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="max-w-lg rounded-[28px] border border-zinc-200 bg-[var(--surface-base)] px-8 py-10 text-center shadow-sm dark:border-zinc-700">
          <Image
            src={logo}
            alt="Branham Sermons Assistant logo"
            width={76}
            height={76}
            priority
            className="mx-auto mb-5 rounded-2xl object-cover shadow-sm"
          />
          <h2 className="font-display mb-3 text-3xl text-foreground">
            Branham Sermons Assistant
          </h2>
          <p className="text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
    );
  }

  // With a featured card (today's Family Altar): on phones the feature comes
  // first and fills the top of the screen, with a compact welcome below it;
  // on desktop the welcome card and the feature sit side by side.
  // overflow-anchor: none — the card grows when today's devotion loads, and
  // browser scroll anchoring would otherwise scroll its top out of view.
  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-4 pb-6 [overflow-anchor:none] lg:flex-row lg:items-center lg:justify-center lg:gap-5 lg:px-6 lg:py-4">
      <div className="order-1 w-full lg:order-2 lg:w-auto lg:max-w-md lg:flex-1">{extra}</div>
      <div className="order-2 flex items-center gap-3 px-1 lg:order-1 lg:max-w-sm lg:flex-col lg:items-stretch lg:gap-0 lg:rounded-[24px] lg:border lg:border-zinc-200 lg:bg-[var(--surface-base)] lg:px-6 lg:py-6 lg:text-center lg:shadow-sm dark:lg:border-zinc-700">
        <Image
          src={logo}
          alt="Branham Sermons Assistant logo"
          width={76}
          height={76}
          priority
          className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm lg:mx-auto lg:mb-3 lg:h-14 lg:w-14 lg:rounded-2xl"
        />
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight text-foreground lg:mb-2 lg:text-2xl">
            Branham Sermons Assistant
          </h2>
          <p className="text-[13px] leading-snug text-zinc-500 lg:text-sm lg:leading-relaxed dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="mx-4 mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
      {error}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="h-6 w-32 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-3xl bg-zinc-200/80 dark:bg-zinc-800" />
        <div className="ml-auto h-14 w-2/3 animate-pulse rounded-3xl bg-zinc-200/70 dark:bg-zinc-700/70" />
        <div className="h-28 animate-pulse rounded-3xl bg-zinc-200/80 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  streamingStatus,
  streamBuffer,
  error,
  isLoading,
  welcomeDescription,
  finalizingText,
  mode,
  onModeChange,
  answerViewFullLabel,
  answerViewQuotesLabel,
  answerViewQuotesEmpty,
  welcomeExtra,
}: ChatPanelProps) {
  const isEmpty =
    messages.length === 0 && streamingStatus === "idle" && !isLoading;

  return (
    <div className="flex h-full flex-col bg-[var(--surface-chat)]">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase lg:hidden dark:text-zinc-400">
          Chat
        </h2>
        <div className="ml-auto">
          <AnswerViewToggle
            mode={mode}
            onChange={onModeChange}
            fullLabel={answerViewFullLabel}
            quotesLabel={answerViewQuotesLabel}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto [overflow-anchor:none]">
        {isLoading ? (
          <LoadingState />
        ) : isEmpty ? (
          <WelcomeState description={welcomeDescription} extra={welcomeExtra} />
        ) : (
          <MessageList
            messages={messages}
            streamingStatus={streamingStatus}
            streamBuffer={streamBuffer}
            finalizingText={finalizingText}
            mode={mode}
            quotesEmptyText={answerViewQuotesEmpty}
          />
        )}
      </div>

      {error && <ErrorBanner error={error} />}
    </div>
  );
}
