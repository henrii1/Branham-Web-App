import { renderAltarDayOgImage } from "@/components/altar/altarPage";
import { ALTAR_OG_SIZE } from "@/lib/altar/renderAltarOgImage";
import { isIsoDate, utcTodayIso } from "@/lib/altar/week";

export const size = ALTAR_OG_SIZE;
export const contentType = "image/png";
export const alt = "Family Altar";

export default async function Image({ params }: { params: Promise<{ lang: string; day: string }> }) {
  const { lang, day } = await params;
  const language = lang === "es" || lang === "fr" ? lang : "en";
  return renderAltarDayOgImage(language, isIsoDate(day) ? day : utcTodayIso());
}
