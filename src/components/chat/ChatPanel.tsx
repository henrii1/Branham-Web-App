"use client";

import Image from "next/image";
import type { Message, StreamingStatus } from "@/lib/chat/types";
import { MessageList } from "./MessageList";
import logo from "../../../logo.png";

interface ChatPanelProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  error: string | null;
  isLoading?: boolean;
}

function WelcomeState() {
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
          Ask questions about the sermons of William Marrion Branham. Your
          answers are grounded in the original sermon texts.
        </p>
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
}: ChatPanelProps) {
  const isEmpty =
    messages.length === 0 && streamingStatus === "idle" && !isLoading;

  return (
    <div className="flex h-full flex-col bg-[var(--surface-chat)]">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 lg:hidden dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Chat
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : isEmpty ? (
          <WelcomeState />
        ) : (
          <MessageList
            messages={messages}
            streamingStatus={streamingStatus}
            streamBuffer={streamBuffer}
          />
        )}
      </div>

      {error && <ErrorBanner error={error} />}
    </div>
  );
}
