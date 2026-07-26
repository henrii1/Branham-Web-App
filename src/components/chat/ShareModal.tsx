"use client";

import { useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface ShareModalProps {
  onClose: () => void;
  strings: ChatStrings;
  shareUrl: string;
}

export function ShareModal({ onClose, strings, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {strings.shareModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.shareClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareLinkLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? strings.shareCopied : strings.shareCopyLink}
          </button>
        </div>
      </div>
    </div>
  );
}
