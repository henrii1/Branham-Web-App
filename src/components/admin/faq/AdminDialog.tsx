"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { renderMarkdown } from "@/lib/markdown/render";
import { applyCitations } from "@/lib/markdown/citations";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";
import { stripAnswerPrefix } from "@/lib/utils/answerDedup";

/** Modal shell for the admin FAQ tools, styled like ShareModal. */
export function AdminDialog({
  title,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Blocks closing (backdrop, Esc, ✕) while a request is in flight. */
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !closeDisabled) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, closeDisabled]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={() => !closeDisabled && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Renders an FAQ answer with the same pipeline as the /q page's finished
 * state (TypewriterRenderer once complete), citation pills included.
 * Computed directly from the prop so it always shows the current text —
 * TypewriterRenderer keeps its chunks in a ref and can show stale text when
 * the markdown changes but the paragraph count doesn't.
 */
export function FaqAnswerPreview({ markdown, language }: { markdown: string; language: string }) {
  const html = useMemo(
    () => applyCitations(renderMarkdown(postprocessChatResponse(stripAnswerPrefix(markdown)))),
    [markdown],
  );
  return (
    <div
      data-message-lang={language}
      className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-[var(--surface-chat)] px-4 py-3 dark:border-zinc-700"
    >
      <div
        className="chat-markdown prose prose-sm prose-zinc max-w-none break-words dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-blockquote:border-l-zinc-300 dark:prose-blockquote:border-l-zinc-600"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export const adminInputClass =
  "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-700";

export const adminPrimaryButtonClass =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export const adminSecondaryButtonClass =
  "rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

export async function postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
}
