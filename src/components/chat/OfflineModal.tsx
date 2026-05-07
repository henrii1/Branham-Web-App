"use client";

import { useEffect, useRef } from "react";

interface OfflineModalProps {
  onRetry: () => void;
  onDismiss: () => void;
}

export function OfflineModal({ onRetry, onDismiss }: OfflineModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
      onClick={(e) => {
        if (e.target === overlayRef.current) onDismiss();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-5 w-5 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              {/* wifi-off-style glyph */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18M8.288 14.212a5.25 5.25 0 0 1 7.424 0M5.106 11.03a9.75 9.75 0 0 1 4.073-2.292m4.762 0a9.75 9.75 0 0 1 4.953 2.706M1.371 8.143a14.25 14.25 0 0 1 5.46-3.225m4.756-.585c4.05.227 7.806 1.957 10.522 4.66M12 18.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h2
              id="offline-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              You&apos;re offline
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Your message couldn&apos;t be sent. Please check your internet
              connection and try again.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
