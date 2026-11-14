"use client";

import { useMemo } from "react";
import type { RagData, StreamingStatus } from "@/lib/chat/types";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import { PassageCards, passageCardsCopy } from "./PassageCards";

interface SourcesPanelProps {
  ragData: RagData | null;
  streamingStatus: StreamingStatus;
  passagesTitle: string;
  passagesDescription: string;
  passagesSectionHeader: string;
  language?: string;
}

/** Before the first answer: faint outlines of the passage cards to come, and what will appear there. */
function EmptyState({ description }: { title: string; description: string }) {
  const ghost = (
    <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700" aria-hidden="true">
      <span className="h-2 w-[46%] rounded bg-[var(--home-chip)]" />
      <span className="h-2 w-full rounded bg-zinc-200/80 dark:bg-zinc-800" />
      <span className="h-2 w-[88%] rounded bg-zinc-200/80 dark:bg-zinc-800" />
      <span className="h-2 w-[64%] rounded bg-zinc-200/80 dark:bg-zinc-800" />
    </div>
  );
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-8 py-6">
      {ghost}
      {ghost}
      <p className="mt-1 text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="rounded-2xl border border-zinc-200 bg-[var(--surface-base)] px-6 py-5 text-center shadow-sm dark:border-zinc-700">
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
          Searching sermon passages…
        </p>
      </div>
    </div>
  );
}

export function SourcesPanel({
  ragData,
  streamingStatus,
  passagesTitle,
  passagesDescription,
  passagesSectionHeader,
  language = "en",
}: SourcesPanelProps) {
  const isLoading = streamingStatus === "connecting";
  const hasNoContent = !ragData && streamingStatus === "idle";

  // Cleaned once; shown as one card per sermon (no citation styling here: §8, chat panel only).
  const cleaned = useMemo(() => (ragData ? postprocessRag(ragData.ragContext) : ""), [ragData]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-sources)]">
      <div className="flex items-center border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {passagesSectionHeader}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <LoadingState />}
        {hasNoContent && !isLoading && <EmptyState title={passagesTitle} description={passagesDescription} />}
        {ragData && <PassageCards context={cleaned} query={ragData.retrievalQuery} copy={passageCardsCopy(language)} />}
      </div>
    </div>
  );
}
