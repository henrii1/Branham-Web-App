import { renderAltarDayImage } from "@/components/altar/altarPage";
import { isIsoDate } from "@/lib/altar/week";
import type { AltarImageFormat } from "@/lib/altar/renderAltarOgImage";

/**
 * GET /api/altar/image?day=2026-10-12&lang=en&format=story|post
 * The day's shareable image (PNG), attached by the Share button so the post
 * is a picture everywhere (Status, channels, Instagram, Facebook), with the
 * link in the caption. Only days readers can already see are drawn (the
 * public, RLS-scoped read); any other day gets the generic image.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const day = params.get("day") ?? "";
  const lang = params.get("lang");
  const format = params.get("format");
  if (!isIsoDate(day) || (format !== "story" && format !== "post")) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const language = lang === "es" || lang === "fr" ? lang : "en";
  return renderAltarDayImage(language, day, format as AltarImageFormat, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
