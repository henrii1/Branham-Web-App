"use client";

import { useMemo } from "react";
import type { Message, AnswerViewMode } from "@/lib/chat/types";
import { renderMarkdown } from "@/lib/markdown/render";
import {
  applyCitations,
  stripParagraphLetterSuffixes,
  extractOrderedCitations,
  dedupeCitations,
  renderCitationList,
} from "@/lib/markdown/citations";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

interface MessageBubbleProps {
  message: Message;
  mode?: AnswerViewMode;
  quotesEmptyText?: string;
}

export function MessageBubble({
  message,
  mode = "full",
  quotesEmptyText = "No sermon quotes cited in this answer.",
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Memoize the full render pipeline for assistant messages.
  // Messages are immutable once added, so this only runs once per message
  // per mode.
  const renderedHtml = useMemo(() => {
    if (isUser) return "";
    // stripAnswerPrefix at render time catches historical DB messages saved before dedup existed
    // stripParagraphLetterSuffixes at render catches historical messages; new ones are normalized before save
    const cleaned = stripParagraphLetterSuffixes(stripAnswerPrefix(message.content));
    const processed = postprocessChatResponse(cleaned);
    const html = renderMarkdown(processed);

    if (mode === "quotes") {
      const entries = dedupeCitations(extractOrderedCitations(html));
      if (entries.length === 0) {
        return `<p class="answer-view-empty">${quotesEmptyText}</p>`;
      }
      return renderCitationList(entries);
    }

    return applyCitations(html);
  }, [isUser, message.content, mode, quotesEmptyText]);

  if (isUser) {
    return (
      <div
        className="flex justify-end"
        role="article"
        aria-label="Your message"
      >
        <div className="max-w-[85%] rounded-[24px] bg-zinc-200/90 px-4 py-3 text-base lg:text-sm leading-relaxed text-zinc-900 shadow-sm sm:max-w-[75%] dark:bg-zinc-700/90 dark:text-zinc-100">
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
        data-message-lang={message.language ?? "en"}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
