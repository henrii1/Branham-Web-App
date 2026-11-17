"use client";

import { useState } from "react";

/**
 * A YouTube video that plays in place: a thumbnail until tapped, then the
 * privacy-enhanced player (youtube-nocookie), so nothing from YouTube loads
 * before the reader asks for it.
 *
 * `upright` is a Short: its portrait thumbnail (oar2.jpg, 1080×1920; the
 * large landscape one if a video has none) in a slim device frame, with the
 * title under the frame. A title like "Baby Turtles … | The Nature Series
 * Part 1" is split: the part after " | " becomes the small label above it.
 */
export function VideoCard({
  id,
  title,
  big = false,
  upright = false,
}: {
  id: string;
  title: string;
  big?: boolean;
  upright?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  if (upright) {
    const [main, ...rest] = title.split(" | ");
    const series = rest.join(" | ");
    return (
      <figure className="flex flex-col gap-4">
        <div className="rounded-[30px] bg-gradient-to-b from-white/[.16] to-white/[.04] p-[7px] shadow-[0_30px_60px_-28px_rgba(0,0,0,.75)] ring-1 ring-white/15">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] bg-black">
            {playing ? (
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
                title={main}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={main}
                className="group absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--home-leaf)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${id}/oar2.jpg`}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.src.endsWith("hq720.jpg")) img.src = `https://i.ytimg.com/vi/${id}/hq720.jpg`;
                  }}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <span className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
                <span className="absolute top-1/2 left-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg ring-4 ring-white/20 transition-transform duration-300 group-hover:scale-110">
                  <svg className="ml-1 h-6 w-6" viewBox="0 0 24 24" fill="#0b1d16" aria-hidden="true">
                    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
                  </svg>
                </span>
              </button>
            )}
          </div>
        </div>
        <figcaption className="flex flex-col gap-1 px-1">
          {series && <span className="text-[13px] font-medium text-[var(--home-leaf)]">{series}</span>}
          <span className="font-display text-[19px] leading-snug text-pretty text-[#edf0e8]">{main}</span>
        </figcaption>
      </figure>
    );
  }

  const shape = big ? "aspect-video lg:row-span-2 lg:aspect-auto lg:min-h-full" : "aspect-video";
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black/40 ${shape}`}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 text-left" aria-label={title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hq720.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          <span className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-black/75" />
          <span className={`absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 ${big ? "h-16 w-16" : "h-12 w-12"}`}>
            <svg className={big ? "ml-1 h-6 w-6" : "ml-0.5 h-5 w-5"} viewBox="0 0 24 24" fill="#0b1d16" aria-hidden="true">
              <path d="M7 4.5v15l12-7.5-12-7.5Z" />
            </svg>
          </span>
          <span className={`font-display absolute right-5 bottom-4 left-5 leading-tight text-white ${big ? "text-2xl" : "text-[17px]"}`}>{title}</span>
        </button>
      )}
    </div>
  );
}
