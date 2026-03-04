"use client";

import type { Message } from "@/lib/chat/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div
        className="flex justify-end"
        role="article"
        aria-label="Your message"
      >
        <div className="max-w-[85%] rounded-2xl bg-zinc-200 px-4 py-2.5 text-sm leading-relaxed text-zinc-900 sm:max-w-[75%] dark:bg-zinc-700 dark:text-zinc-100">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="article" aria-label="Assistant message">
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
        {message.content}
      </div>
    </div>
  );
}
