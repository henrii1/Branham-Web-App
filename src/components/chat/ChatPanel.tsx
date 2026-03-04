"use client";

import type { Message, StreamingStatus } from "@/lib/chat/types";
import { MessageList } from "./MessageList";

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
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg
            className="h-7 w-7 text-zinc-600 dark:text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">
          Branham Sermons AI
        </h2>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Ask questions about the sermons of William Marrion Branham. Your
          answers are grounded in the original sermon texts.
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="mx-4 mt-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
      {error}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
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
        Loading conversation…
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
    <div className="flex h-full flex-col">
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
