"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown/render";
import { applyCitations } from "@/lib/markdown/citations";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

interface TypewriterRendererProps {
  markdown: string;
  /** Delay in ms between paragraph reveals. Default 120. */
  chunkDelayMs?: number;
  /** If true, skip animation and render all at once. */
  skipAnimation?: boolean;
}

/**
 * Simulates streaming by revealing the answer paragraph-by-paragraph
 * with a typewriter-like delay. On completion, applies citation styling.
 */
export function TypewriterRenderer({
  markdown,
  chunkDelayMs = 120,
  // Ready answers open in full: they're promised as instant, and a page that
  // grows a paragraph at a time can't be scrolled until it finishes.
  skipAnimation = true,
}: TypewriterRendererProps) {
  if (skipAnimation) return <FullAnswer markdown={markdown} />;
  return <AnimatedAnswer markdown={markdown} chunkDelayMs={chunkDelayMs} />;
}

/** The whole answer at once (also in the server HTML), with a short fade-in. */
function FullAnswer({ markdown }: { markdown: string }) {
  const html = applyCitations(renderMarkdown(postprocessChatResponse(stripAnswerPrefix(markdown))));
  return (
    <div
      className="chat-markdown prose prose-sm prose-zinc max-w-none break-words motion-safe:animate-[answer-in_.35s_ease-out] dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-blockquote:border-l-zinc-300 dark:prose-blockquote:border-l-zinc-600"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AnimatedAnswer({ markdown, chunkDelayMs }: { markdown: string; chunkDelayMs: number }) {
  const skipAnimation = false;
  const chunks = useRef<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [complete, setComplete] = useState(skipAnimation);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    chunks.current = splitIntoChunks(stripAnswerPrefix(markdown));

    if (skipAnimation) {
      setVisibleCount(chunks.current.length);
      setComplete(true);
      return;
    }

    setVisibleCount(0);
    setComplete(false);
    let idx = 0;

    function tick() {
      idx++;
      setVisibleCount(idx);
      if (idx >= chunks.current.length) {
        setComplete(true);
      } else {
        timerRef.current = setTimeout(tick, chunkDelayMs);
      }
    }

    timerRef.current = setTimeout(tick, chunkDelayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [markdown, chunkDelayMs, skipAnimation]);

  const handleSkip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisibleCount(chunks.current.length);
    setComplete(true);
  }, []);

  const visibleMarkdown = chunks.current.slice(0, visibleCount).join("\n\n");
  const processed = postprocessChatResponse(visibleMarkdown);
  const rawHtml = renderMarkdown(processed);
  const html = complete ? applyCitations(rawHtml) : rawHtml;

  return (
    <div className="relative">
      <div
        className="chat-markdown prose prose-sm prose-zinc max-w-none break-words dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-blockquote:border-l-zinc-300 dark:prose-blockquote:border-l-zinc-600"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {!complete && (
        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Skip animation
        </button>
      )}
    </div>
  );
}

function splitIntoChunks(markdown: string): string[] {
  const raw = markdown.split(/\n{2,}/);
  return raw.filter((chunk) => chunk.trim().length > 0);
}
