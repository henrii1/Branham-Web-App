"use client";

import { useMemo } from "react";
import type { Message } from "@/lib/chat/types";
import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  stripParagraphLetterSuffixes,
} from "@/lib/markdown/citations";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Memoize the full render pipeline for assistant messages.
  // Messages are immutable once added, so this only runs once per message.
  const renderedHtml = useMemo(() => {
    if (isUser) return "";
    // stripAnswerPrefix at render time catches historical DB messages saved before dedup existed
    // stripParagraphLetterSuffixes at render catches historical messages; new ones are normalized before save
    const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(message.content));
    const processed = postprocessChatResponse(cleaned);
    const html = renderMarkdown(processed);
    return applyCitations(html);
  }, [isUser, message.content]);

  if (isUser) {
    return (
      <div
        className="flex justify-end"
        role="article"
        aria-label="Your message"
      >
        <div className="max-w-[85%] rounded-[24px] bg-zinc-200/90 px-4 py-3 text-sm leading-relaxed text-zinc-900 shadow-sm sm:max-w-[75%] dark:bg-zinc-700/90 dark:text-zinc-100">
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="article" aria-label="Assistant message">
      <div
        className="chat-markdown prose prose-sm prose-zinc max-w-none break-words dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
