"use client";

import { useEffect, useState } from "react";

interface SwipeAffordanceProps {
  /** "right" → user should swipe right (showing on chat tab, sources ready).
   *  "left"  → user should swipe left (showing on sources tab, chat ready). */
  direction: "left" | "right";
}

/**
 * Edge-of-viewport swipe affordance for mobile.
 *
 * Pinned to the right or left edge of the chat slider, vertically centered.
 * `mix-blend-mode: difference` makes the outline auto-invert against any
 * underlying text/background — readable on light or dark, never obscures
 * the content beneath it (no fill).
 *
 * Behavior:
 *   - Active state: animates 3 cycles (drift + fade in the swipe direction)
 *     when first mounted. Peak opacity is moderate so it draws the eye
 *     without competing with the chat text.
 *   - Resting state: after the active animation completes, settles to a low
 *     persistent opacity. Still discoverable for users who looked away
 *     during the animation, but no longer noisy.
 *   - Honors `prefers-reduced-motion`: skips the animated state, fades
 *     directly to the resting state.
 *
 * The parent is expected to mount/unmount this component as content
 * readiness changes — the active animation is keyed to a fresh mount.
 */
export function SwipeAffordance({ direction }: SwipeAffordanceProps) {
  // Only ever flips once per mount (false → true after the active animation
  // finishes). The parent unmounts us when the affordance no longer applies,
  // so a fresh mount means a fresh active phase.
  const [activeExpired, setActiveExpired] = useState(false);

  useEffect(() => {
    // 3 cycles × 1.4s each = 4.2s total active duration.
    const t = setTimeout(() => setActiveExpired(true), 4200);
    return () => clearTimeout(t);
  }, []);

  const edgeClass = direction === "right" ? "right-3" : "left-3";
  const animationClass = activeExpired
    ? "swipe-affordance-resting"
    : direction === "right"
      ? "swipe-affordance-active-right"
      : "swipe-affordance-active-left";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${edgeClass} ${animationClass} swipe-affordance lg:hidden`}
    >
      {/* Double chevron — outline-only, currentColor + mix-blend-mode handled in CSS.
          The trailing chevron is offset and slightly fainter, creating a
          deliberate motion-trail rather than a simple symbol. */}
      <svg
        width="44"
        height="80"
        viewBox="0 0 44 80"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "right" ? (
          <>
            <path d="M10 22 L26 40 L10 58" opacity="0.55" />
            <path d="M22 22 L38 40 L22 58" />
          </>
        ) : (
          <>
            <path d="M34 22 L18 40 L34 58" opacity="0.55" />
            <path d="M22 22 L6 40 L22 58" />
          </>
        )}
      </svg>
    </div>
  );
}
