/**
 * Videos for the home page's "Stories from creation". Server only.
 *
 * The channel's most-liked videos are shown (ties: most viewed, then
 * newest). Two sources, best first:
 *  - YOUTUBE_API_KEY set (optional secret): the YouTube Data API ranks
 *    every upload on the channel (up to MAX_RANKED).
 *  - otherwise the channel's public feed, which carries like and view
 *    counts but only for the 15 newest uploads.
 * FEATURED_VIDEO_IDS overrides both by hand. Shorts (vertical) are flagged so
 * the page can show them upright. With no uploads at all, the page shows an
 * invitation to subscribe instead of empty frames. Never throws.
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
  /** Served from the site (public/films) instead of YouTube. */
  file?: { src: string; poster: string };
}

/**
 * Our own films, served from public/films, shown on the English home page
 * only while the channel has no public videos (their captions are in
 * English). Once anything is on the channel, YouTube's videos replace them;
 * then delete public/films and this list.
 */
export const SITE_FILMS: YouTubeVideo[] = [
  ["the-seed-that-has-to-die", "The seed that has to die"],
  ["the-sun-that-never-forgets-to-rise", "The sun that never forgets to rise"],
  ["the-lost-sheep", "The lost sheep"],
].map(([slug, title]) => ({
  id: slug,
  title,
  short: false,
  likes: 0,
  views: 0,
  published: "",
  file: { src: `/films/${slug}.mp4`, poster: `/films/${slug}.jpg` },
}));

/** Hand-picked videos (ids from youtube.com/watch?v=ID or /shorts/ID), shown in this order. Empty: most liked. */
export const FEATURED_VIDEO_IDS: string[] = [];

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
      title: decodeXml(title),
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
        title: v.snippet?.title ?? "",
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

/** Most liked first; ties by views, then newest. Exported for testing. */
export function rankByLikes(videos: YouTubeVideo[]): YouTubeVideo[] {
  return [...videos].sort((a, b) => b.likes - a.likes || b.views - a.views || b.published.localeCompare(a.published));
}

/** The videos to show: the featured ones, else the most liked, else (English only) our own films. Never throws. */
export async function fetchHomeVideos(lang = "en"): Promise<YouTubeVideo[]> {
  const videos = await fetchChannelVideos();
  return videos.length || lang !== "en" ? videos : SITE_FILMS;
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
  if (FEATURED_VIDEO_IDS.length) {
    const known = new Map(all.map((v) => [v.id, v]));
    return FEATURED_VIDEO_IDS.slice(0, HOME_VIDEO_COUNT).map(
      (id) => known.get(id) ?? { id, title: "", short: false, likes: 0, views: 0, published: "" },
    );
  }
  return rankByLikes(all).slice(0, HOME_VIDEO_COUNT);
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
