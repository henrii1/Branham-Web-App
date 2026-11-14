"use client";

import { useState } from "react";

/**
 * A YouTube video that plays in place: a thumbnail until tapped, then the
 * privacy-enhanced player (youtube-nocookie), so nothing from YouTube loads
 * before the reader asks for it. `upright` is the 9:16 frame for Shorts
 * (the landscape thumbnail is cropped to the vertical frame inside it).
 */
export function VideoCard({
  id,
  title,
  big = false,
  upright = false,
  file,
}: {
  id: string;
  title: string;
  big?: boolean;
  upright?: boolean;
  /** One of our own films served from the site: plays in a <video> instead of YouTube's player. */
  file?: { src: string; poster: string };
}) {
  const [playing, setPlaying] = useState(false);
  const shape = upright ? "aspect-[9/16]" : big ? "aspect-video lg:row-span-2 lg:aspect-auto lg:min-h-full" : "aspect-video";
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black/40 ${shape}`}>
      {playing && file ? (
        <video className="absolute inset-0 h-full w-full bg-black object-contain" src={file.src} poster={file.poster} controls autoPlay playsInline preload="auto" />
      ) : playing ? (
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
          <img src={file?.poster ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
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
