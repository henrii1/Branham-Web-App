"use client";

import { useRef, useCallback, useState } from "react";
import type { StreamingStatus } from "@/lib/chat/types";

interface ComposerProps {
  onSend: (content: string) => void;
  disabled: boolean;
  streamingStatus: StreamingStatus;
}

const MAX_TEXTAREA_HEIGHT = 200;

export function Composer({ onSend, disabled, streamingStatus }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming =
    streamingStatus === "connecting" ||
    streamingStatus === "rag_received" ||
    streamingStatus === "streaming";

  const isDisabled = disabled || isStreaming;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isDisabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex-shrink-0 border-t border-zinc-200 bg-[var(--surface-base)] px-4 py-3 dark:border-zinc-700">
      <div className="mx-auto flex max-w-4xl items-end gap-2 xl:max-w-[56rem]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming ? "Waiting for response…" : "Ask a question…"
          }
          disabled={isDisabled}
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-zinc-300 bg-[var(--surface-soft)] px-4 py-3 text-base lg:text-sm text-foreground placeholder:text-zinc-400 transition-colors focus:border-blue-500 focus:bg-[var(--surface-base)] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:focus:bg-zinc-800"
          aria-label="Message input"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled || !value.trim()}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          aria-label="Send message"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
