"use client";

import { useEffect, useRef } from "react";
import type { Message, StreamingStatus } from "@/lib/chat/types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
}

function StreamingIndicator({ status }: { status: StreamingStatus }) {
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 py-2">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    );
  }

  if (status === "rag_received") {
    return (
      <div className="py-2">
        <p className="animate-pulse text-sm text-zinc-400 dark:text-zinc-500">
          Finalizing response…
        </p>
      </div>
    );
  }

  return null;
}

function StreamingText({ content }: { content: string }) {
  return (
    <div role="article" aria-label="Assistant message">
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
        {content}
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-900 dark:bg-zinc-100" />
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  streamingStatus,
  streamBuffer,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamBuffer, streamingStatus]);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {streamingStatus === "streaming" && streamBuffer && (
        <StreamingText content={streamBuffer} />
      )}

      <StreamingIndicator status={streamingStatus} />

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
