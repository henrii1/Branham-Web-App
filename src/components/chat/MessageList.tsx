"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Message, StreamingStatus } from "@/lib/chat/types";
import { MessageBubble } from "./MessageBubble";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripParagraphLetterSuffixes } from "@/lib/markdown/citations";

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

/**
 * Renders the streaming buffer as markdown (no citation styling).
 * Citation styling is applied only on the final message render.
 */
function StreamingText({ content }: { content: string }) {
  const html = useMemo(() => {
    const normalized = stripParagraphLetterSuffixes(content);
    const processed = postprocessChatResponse(normalized);
    return renderMarkdown(processed);
  }, [content]);

  return (
    <div role="article" aria-label="Assistant message">
      <div
        className="chat-markdown prose prose-sm prose-zinc max-w-none break-words dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-900 dark:bg-zinc-100" />
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
      className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6 xl:max-w-[56rem]"
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
