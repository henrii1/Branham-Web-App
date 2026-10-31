"use client";

import { useRef, useCallback, useState, useLayoutEffect } from "react";
import type { StreamingStatus } from "@/lib/chat/types";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";

interface ComposerProps {
  onSend: (content: string) => void;
  disabled: boolean;
  streamingStatus: StreamingStatus;
  placeholder?: string;
  waitingPlaceholder?: string;
  /** A short line under the box (e.g. how follow-ups are answered). */
  note?: string;
}

// The box grows with its content up to this share of the viewport height,
// then scrolls internally. Generous enough that a long question stays
// readable while typing, without pushing the answer off-screen.
const MAX_TEXTAREA_VH = 40;

export function Composer({
  onSend,
  disabled,
  streamingStatus,
  placeholder = "Ask a question…",
  waitingPlaceholder = "Waiting for response…",
  note,
}: ComposerProps) {
  const [value, setValue] = useState("");
  // Live transcript shown while the mic is active (not yet committed).
  const [interimTranscript, setInterimTranscript] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming =
    streamingStatus === "connecting" ||
    streamingStatus === "rag_received" ||
    streamingStatus === "streaming";

  const isDisabled = disabled || isStreaming;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setValue("");
    setInterimTranscript("");
  }, [value, isDisabled, onSend]);

  // Return inserts a new line (the textarea's default). Sending is only
  // through the Send button — on phones Return is the only way to start a
  // new line, so it must never submit.

  const { isSupported, isRecording, startRecording, stopRecording } =
    useVoiceInput({
      onInterimResult: useCallback((transcript: string) => {
        setInterimTranscript(transcript);
      }, []),
      onFinalResult: useCallback((transcript: string) => {
        setInterimTranscript("");
        setValue((prev) => {
          const base = prev.trimEnd();
          return base ? `${base} ${transcript}` : transcript;
        });
      }, []),
    });

  // What the textarea renders: committed text + live interim voice text.
  const displayValue = interimTranscript
    ? value.trimEnd()
      ? `${value.trimEnd()} ${interimTranscript}`
      : interimTranscript
    : value;

  // Fit the height to the content after every change, whatever caused it
  // (typing, paste, autocorrect, voice, clearing after send), before paint.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const max = (window.innerHeight * MAX_TEXTAREA_VH) / 100;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [displayValue]);

  return (
    <div className="flex-shrink-0 border-t border-zinc-200 bg-[var(--surface-base)] px-4 py-3 dark:border-zinc-700">
      <div className="mx-auto flex max-w-4xl items-end gap-2 xl:max-w-[56rem]">
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => {
            // Block edits while voice is actively streaming interim text.
            if (isRecording) return;
            setValue(e.target.value);
          }}
          enterKeyHint="enter"
          placeholder={isStreaming ? waitingPlaceholder : placeholder}
          disabled={isDisabled}
          rows={1}
          className={`flex-1 resize-none rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-base lg:text-sm text-foreground placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:focus:bg-zinc-800 ${
            isRecording
              ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-300 dark:bg-red-950/20 dark:border-red-600"
              : "border-zinc-300 focus:border-blue-500 focus:bg-[var(--surface-base)] focus:ring-blue-500"
          }`}
          aria-label="Message input"
          style={{ maxHeight: `${MAX_TEXTAREA_VH}vh` }}
        />

        {/* Microphone button — hidden when browser doesn't support it */}
        {isSupported && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isDisabled}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isRecording
                ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
            aria-label={isRecording ? "Stop recording" : "Use voice input"}
          >
            {isRecording ? (
              // Pulsing dot while recording
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z"
                />
              </svg>
            )}
          </button>
        )}

        {/* Send button */}
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
      {note && <ComposerNote text={note} />}
    </div>
  );
}

/** One quiet line under a chat box, aligned with it. */
export function ComposerNote({ text }: { text: string }) {
  return <p className="mx-auto mt-2 max-w-4xl px-1 text-xs leading-snug text-zinc-500 xl:max-w-[56rem] dark:text-zinc-400">{text}</p>;
}
