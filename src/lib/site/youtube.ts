/**
 * Videos for the home page's "Stories from creation". Server only.
 *
 * The home page shows the Nature Series (FEATURED_VIDEOS, in series order);
 * everything else on the channel is one tap away ("More on YouTube"), since
 * later uploads won't all be about nature. If FEATURED_VIDEOS is emptied, the
 * channel's first three uploads are shown instead. Sources, best first:
 *  - YOUTUBE_API_KEY set (optional secret): the YouTube Data API lists
 *    every upload on the channel (up to MAX_RANKED).
 *  - otherwise the channel's public feed (only the 15 newest uploads), which
 *    is why the featured videos carry their own title and Short flag.
 * Shorts (vertical) are flagged so the page can show them upright. With no
 * videos at all, the page shows an invitation to subscribe. Never throws.
 */

import { YOUTUBE_CHANNEL_ID } from "./social";

export interface YouTubeVideo {
  id: string;
  title: string;
  /** A YouTube Short (vertical, up to 3 minutes). */
  short: boolean;
  likes: number;
  views: number;
  published: string;
}

/**
 * The videos shown, in this order (ids from youtube.com/watch?v=ID or /shorts/ID).
 * Title and Short flag are fallbacks for when the feed no longer lists a video;
 * the live title wins. Empty: the channel's first three uploads.
 */
export const FEATURED_VIDEOS: { id: string; title: string; short: boolean }[] = [
  { id: "dmhINwMo5yQ", title: "Baby Turtles Follow the Wrong Light 🐢🌙 | The Nature Series Part 1", short: true },
  { id: "QYpv2G_GSIk", title: "The Salmon's Last Journey Home 🐟 | The Nature Series Part 2", short: true },
  { id: "2qXUlo2z0gk", title: "He Thought the Water Was Holding Him Back 🐟 | The Nature Series Part 3", short: true },
];

export const HOME_VIDEO_COUNT = 3;
const MAX_RANKED = 200;
const REVALIDATE = 3600;

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
const API = "https://www.googleapis.com/youtube/v3";

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** A title without its trailing hashtags ("… Part 3 #faith #nature" → "… Part 3"). */
export function cleanTitle(title: string): string {
  return title.replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
}

/** Parse the channel feed's entries (newest first). Exported for testing. */
export function parseYouTubeFeed(xml: string): YouTubeVideo[] {
  const out: YouTubeVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    if (!id || title === undefined) continue;
    const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
    out.push({
      id,
      title: cleanTitle(decodeXml(title)),
      short: link.includes("/shorts/"),
      likes: Number(entry.match(/<media:starRating count="(\d+)"/)?.[1] ?? 0),
      views: Number(entry.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
      published: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "",
    });
  }
  return out;
}

/** ISO 8601 duration ("PT1M5S") in seconds. */
function seconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- loose YouTube API JSON, read defensively */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return res.json();
}

/** Every upload with its counts, via the Data API (uploads playlist = "UU" + channel id). */
async function fetchFromApi(key: string): Promise<YouTubeVideo[]> {
  const playlist = "UU" + YOUTUBE_CHANNEL_ID.slice(2);
  const ids: string[] = [];
  let page = "";
  do {
    const j = await getJson(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlist}&key=${key}${page ? `&pageToken=${page}` : ""}`);
    for (const it of j.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    page = j.nextPageToken ?? "";
  } while (page && ids.length < MAX_RANKED);

  const out: YouTubeVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await getJson(`${API}/videos?part=snippet,statistics,contentDetails,status&id=${ids.slice(i, i + 50).join(",")}&key=${key}`);
    for (const v of j.items ?? []) {
      if (v.status?.privacyStatus !== "public" || v.status?.embeddable === false) continue;
      out.push({
        id: v.id,
        title: cleanTitle(v.snippet?.title ?? ""),
        // The API doesn't say "Short"; anything up to 3 minutes on this channel is one.
        short: seconds(v.contentDetails?.duration ?? "") <= 180,
        likes: Number(v.statistics?.likeCount ?? 0),
        views: Number(v.statistics?.viewCount ?? 0),
        published: v.snippet?.publishedAt ?? "",
      });
    }
  }
  return out;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

async function fetchFromFeed(): Promise<YouTubeVideo[]> {
  const res = await fetch(FEED_URL, { next: { revalidate: REVALIDATE } });
  return res.ok ? parseYouTubeFeed(await res.text()) : [];
}

/** Oldest upload first. Exported for testing. */
export function firstUploads(videos: YouTubeVideo[]): YouTubeVideo[] {
  return [...videos].sort((a, b) => a.published.localeCompare(b.published));
}

/** The videos to show: the featured ones, else the channel's first uploads. Never throws. */
export async function fetchHomeVideos(): Promise<YouTubeVideo[]> {
  return fetchChannelVideos();
}

async function fetchChannelVideos(): Promise<YouTubeVideo[]> {
  let all: YouTubeVideo[] = [];
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try {
      all = await fetchFromApi(key);
    } catch {
      /* quota or key problem: use the feed */
    }
  }
  if (!all.length) {
    try {
      all = await fetchFromFeed();
    } catch {
      /* YouTube unreachable */
    }
  }
  if (FEATURED_VIDEOS.length) {
    const known = new Map(all.map((v) => [v.id, v]));
    return FEATURED_VIDEOS.slice(0, HOME_VIDEO_COUNT).map(
      (f) => known.get(f.id) ?? { ...f, likes: 0, views: 0, published: "" },
    );
  }
  return firstUploads(all).slice(0, HOME_VIDEO_COUNT);
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
