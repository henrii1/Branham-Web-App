"use client";

import { useEffect, useRef, useMemo, useState, type ReactNode } from "react";
import type { Message, StreamingStatus, AnswerViewMode } from "@/lib/chat/types";
import { MessageBubble } from "./MessageBubble";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripParagraphLetterSuffixes } from "@/lib/markdown/citations";

interface MessageListProps {
  messages: Message[];
  streamingStatus: StreamingStatus;
  streamBuffer: string;
  finalizingText?: string;
  mode?: AnswerViewMode;
  quotesEmptyText?: string;
  /** Bible search: three timed stages in place of "Finalizing response…". */
  stages?: [string, string, string];
  /** Shown under the stages while waiting (e.g. a related answered question). */
  waitTip?: ReactNode;
}

/**
 * Bible answers take 30–45 s and their text arrives only at the end, so
 * the wait is shown as three stages on a timer measured from real answers
 * (rag at ~2.5 s, final at 30–46 s): searching, then structuring from 8 s,
 * then finalizing from 22 s.
 */
const STAGE_AT_MS = [0, 8000, 22000];

function StagedIndicator({ stages, tip }: { stages: [string, string, string]; tip?: ReactNode }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = STAGE_AT_MS.slice(1).map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="py-2">
      <ol className="flex flex-col gap-3" aria-live="polite">
        {stages.map((label, i) => {
          const done = i < stage;
          const now = i === stage;
          return (
            <li key={label} className={`flex items-center gap-3 text-[15px] ${now ? "font-medium text-foreground" : done ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}>
              <span
                aria-hidden="true"
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] ${
                  done
                    ? "border-[var(--home-meadow)] bg-[var(--home-meadow)] dark:border-[var(--home-leaf)] dark:bg-[var(--home-leaf)]"
                    : now
                      ? "animate-spin border-[var(--home-meadow)] border-t-transparent motion-reduce:animate-none dark:border-[var(--home-leaf)] dark:border-t-transparent"
                      : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {done && (
                  <svg className="h-2.5 w-2.5 text-white dark:text-[var(--home-night)]" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
      {tip && <div className="mt-6 border-l-2 border-[var(--home-leaf)] py-1 pl-3.5 text-[14px] leading-normal text-zinc-500 dark:text-zinc-400">{tip}</div>}
    </div>
  );
}

function StreamingIndicator({
  status,
  finalizingText = "Finalizing response…",
}: {
  status: StreamingStatus;
  finalizingText?: string;
}) {
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
          {finalizingText}
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
  finalizingText,
  mode,
  quotesEmptyText,
  stages,
  waitTip,
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
        <MessageBubble
          key={msg.id}
          message={msg}
          mode={mode}
          quotesEmptyText={quotesEmptyText}
        />
      ))}

      {streamingStatus === "streaming" && streamBuffer && (
        <StreamingText content={streamBuffer} />
      )}

      {stages && (streamingStatus === "connecting" || streamingStatus === "rag_received" || (streamingStatus === "streaming" && !streamBuffer)) ? (
        <StagedIndicator stages={stages} tip={waitTip} />
      ) : (
        <StreamingIndicator status={streamingStatus} finalizingText={finalizingText} />
      )}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
