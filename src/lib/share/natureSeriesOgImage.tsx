import { ImageResponse } from "next/og";
import { loadNewsreader } from "@/lib/altar/renderAltarOgImage";
import { fetchNatureSeries } from "@/lib/db/seo-queries";
import { groupName, SECTION_LABELS } from "@/lib/faq/groups";
import { seriesCopy } from "@/lib/faq/series";
import { NATURE_SERIES_OG_SIZE, renderNatureSeriesOgImage } from "./renderNatureSeriesOgImage";

/** The series page's link-preview image in one language (both route files call this). */
export async function natureSeriesOgImage(lang: "en" | "es" | "fr") {
  const c = seriesCopy(lang);
  const sections = await fetchNatureSeries(lang).catch(() => []);
  const content = {
    title: SECTION_LABELS.nature[lang],
    subtitle: c.ogSubtitle(sections.length),
    parts: sections.map((s, i) => ({ label: c.part(i + 1), name: groupName(s.group!, lang) })),
  };
  const text = [content.title, content.subtitle, ...content.parts.flatMap((p) => [p.label, p.name]), "…"].join(" ");
  const font = await loadNewsreader(text, 500);
  return new ImageResponse(renderNatureSeriesOgImage(content), {
    ...NATURE_SERIES_OG_SIZE,
    ...(font ? { fonts: [{ name: "Newsreader", data: font, weight: 500 as const, style: "normal" as const }] } : {}),
  });
}
