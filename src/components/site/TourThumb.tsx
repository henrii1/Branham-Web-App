import type { TourLang } from "@/lib/site/tour";

/** The tour's thumbnail (the home page in its frame) with a play button. */
export function TourThumb({ lang, className = "" }: { lang: TourLang; className?: string }) {
  return (
    <span className={`relative block aspect-video shrink-0 overflow-hidden rounded-xl bg-[var(--home-night)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/tour/tour-${lang}-thumb.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
    </span>
  );
}
