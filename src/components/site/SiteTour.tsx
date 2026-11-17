"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TOUR_COPY, tourPoster, type TourLang } from "@/lib/site/tour";

/**
 * The one-minute site tour (public/tour, made with reels_dir/site_tour): a
 * trigger that opens the video over the page and plays it. Laptops and
 * desktops (wide screen, mouse) get the landscape recording; phones and
 * tablets the portrait one. Silent with on-screen captions, so it can start
 * on its own.
 */
const LAPTOP = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export function SiteTour({
  lang,
  className,
  children,
}: {
  lang: TourLang;
  className?: string;
  /** The trigger's content; defaults to a play disc, the label and the length. */
  children?: ReactNode;
}) {
  const [device, setDevice] = useState<"desk" | "phone" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const c = TOUR_COPY[lang];

  const open = () => setDevice(window.matchMedia(LAPTOP).matches ? "desk" : "phone");
  const close = useCallback(() => {
    setDevice(null);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!device) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [device, close]);

  return (
    <>
      <button ref={trigger} type="button" onClick={open} aria-haspopup="dialog" className={className}>
        {children ?? (
          <>
            <span aria-hidden="true" className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-current/45">
              <svg viewBox="0 0 10 12" className="ml-0.5 h-[11px] w-[11px] fill-current">
                <path d="M0 0l10 6-10 6z" />
              </svg>
            </span>
            <span>{c.label}</span>
            <span className="opacity-60">{c.length}</span>
          </>
        )}
      </button>
      {device && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={c.label}
          className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(5,14,10,.9)] p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label={c.close}
            className="absolute top-[max(12px,env(safe-area-inset-top))] right-[max(12px,env(safe-area-inset-right))] grid h-11 w-11 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-leaf)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <video
            key={device}
            src={`/tour/tour-${lang}-${device}.mp4`}
            poster={tourPoster(lang, device)}
            autoPlay
            muted
            playsInline
            controls
            preload="auto"
            className={
              device === "desk"
                ? "aspect-video max-h-[86vh] w-[min(92vw,1280px)] rounded-xl bg-black shadow-2xl"
                : "aspect-[9/16] h-[min(86svh,900px)] max-w-[94vw] rounded-2xl bg-black shadow-2xl"
            }
          />
        </div>
      )}
    </>
  );
}
