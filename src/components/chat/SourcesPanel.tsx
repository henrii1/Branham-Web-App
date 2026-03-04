"use client";

import type { RagData, StreamingStatus } from "@/lib/chat/types";

interface SourcesPanelProps {
  ragData: RagData | null;
  streamingStatus: StreamingStatus;
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <svg
          className="mx-auto mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Sources will appear here
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <div className="mx-auto mb-2 flex items-center justify-center gap-1">
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
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Searching sources…
        </p>
      </div>
    </div>
  );
}

export function SourcesPanel({ ragData, streamingStatus }: SourcesPanelProps) {
  const isLoading = streamingStatus === "connecting";
  const hasNoContent = !ragData && streamingStatus === "idle";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Sources
        </h2>
        {ragData && (
          <span className="ml-2 inline-flex h-4 items-center rounded-full bg-green-100 px-1.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Available
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <LoadingState />}
        {hasNoContent && !isLoading && <EmptyState />}
        {ragData && (
          <div className="p-4">
            <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {ragData.ragContext}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
