"use client";

import { useCallback, useRef, useState } from "react";

interface DragDividerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sourcesRef: React.RefObject<HTMLDivElement | null>;
  chatRef: React.RefObject<HTMLDivElement | null>;
  onDragEnd: (ratio: number) => void;
}

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function DragDivider({
  containerRef,
  sourcesRef,
  chatRef,
  onDragEnd,
}: DragDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastRatioRef = useRef(0.4);
  const rafRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        lastRatioRef.current = clamp(y / rect.height, MIN_RATIO, MAX_RATIO);
      }
    },
    [containerRef],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        const sources = sourcesRef.current;
        const chat = chatRef.current;
        if (!container || !sources || !chat) return;

        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const ratio = clamp(y / rect.height, MIN_RATIO, MAX_RATIO);

        sources.style.flex = `${ratio} 0 0`;
        chat.style.flex = `${1 - ratio} 0 0`;
        lastRatioRef.current = ratio;
      });
    },
    [isDragging, containerRef, sourcesRef, chatRef],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      cancelAnimationFrame(rafRef.current);
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onDragEnd(lastRatioRef.current);
    },
    [onDragEnd],
  );

  return (
    <div
      className={`group relative z-10 flex h-3 flex-shrink-0 cursor-row-resize touch-none items-center justify-center transition-colors ${
        isDragging
          ? "bg-zinc-200/80 dark:bg-zinc-700/50"
          : "hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize panels"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!containerRef.current || !sourcesRef.current || !chatRef.current)
          return;
        const step = 0.05;
        let newRatio = lastRatioRef.current;
        if (e.key === "ArrowUp") newRatio -= step;
        else if (e.key === "ArrowDown") newRatio += step;
        else return;
        e.preventDefault();
        newRatio = clamp(newRatio, MIN_RATIO, MAX_RATIO);
        sourcesRef.current.style.flex = `${newRatio} 0 0`;
        chatRef.current.style.flex = `${1 - newRatio} 0 0`;
        lastRatioRef.current = newRatio;
        onDragEnd(newRatio);
      }}
    >
      <div
        className={`h-1.5 w-14 rounded-full transition-colors ${
          isDragging
            ? "bg-zinc-500 dark:bg-zinc-300"
            : "bg-zinc-400 group-hover:bg-zinc-500 dark:bg-zinc-500 dark:group-hover:bg-zinc-300"
        }`}
      />
    </div>
  );
}
