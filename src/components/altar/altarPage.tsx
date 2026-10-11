import type { Metadata } from "next";
import { AltarView } from "./AltarView";
import { ImageResponse } from "next/og";
import { fetchPublishedAltarDay, fetchPublishedAltarDays } from "@/lib/altar/queries";
import { ALTAR_STRINGS, altarDayHref, altarHref } from "@/lib/altar/strings";
import { ALTAR_IMAGE_DOMAIN, ALTAR_IMAGE_SIZES, ALTAR_OG_BRAND, loadNewsreader, renderAltarImage, type AltarImageFormat } from "@/lib/altar/renderAltarOgImage";
import type { AltarLanguage, FamilyAltarDay } from "@/lib/altar/types";

const SITE_URL = "https://branhamsermons.ai";

export function buildAltarMetadata(language: AltarLanguage): Metadata {
  const s = ALTAR_STRINGS[language];
  return {
    title: { absolute: `${s.pageTitle} | Branham Sermons AI` },
    description: s.metaDescription,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${SITE_URL}${altarHref(language)}`,
      languages: { en: `${SITE_URL}/altar`, es: `${SITE_URL}/es/altar`, fr: `${SITE_URL}/fr/altar`, "x-default": `${SITE_URL}/altar` },
    },
    openGraph: { title: s.pageTitle, description: s.metaDescription, url: `${SITE_URL}${altarHref(language)}`, type: "website", siteName: "Branham Sermons Assistant" },
  };
}

/** The row a day link shows: the page's language, else English. */
function dayLanguages(language: AltarLanguage): AltarLanguage[] {
  return language === "en" ? ["en"] : [language, "en"];
}

function longDate(day: string, locale: string): string {
  const d = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Metadata for one day's link: the devotion title and verse, for link previews. */
export async function buildAltarDayMetadata(language: AltarLanguage, day: string): Promise<Metadata> {
  const s = ALTAR_STRINGS[language];
  const base = buildAltarMetadata(language);
  const url = `${SITE_URL}${altarDayHref(language, day)}`;
  const row = await fetchPublishedAltarDay(day, dayLanguages(language)).catch(() => null);
  const title = row?.title ? `${row.title} | ${s.pageTitle}` : `${s.pageTitle}: ${longDate(day, s.locale)}`;
  const description = row ? `“${row.scripture_text}” ${row.scripture_ref} (KJV)` : s.metaDescription;
  return {
    ...base,
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { en: `${SITE_URL}/altar/${day}`, es: `${SITE_URL}/es/altar/${day}`, fr: `${SITE_URL}/fr/altar/${day}`, "x-default": `${SITE_URL}/altar/${day}` },
    },
    openGraph: { title, description, url, type: "article", siteName: "Branham Sermons Assistant" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * One day's image: the link preview (opengraph-image.tsx in both day routes,
 * format "og") or the shareable post/story image (/api/altar/image).
 */
export async function renderAltarDayImage(language: AltarLanguage, day: string, format: AltarImageFormat = "og", init?: ResponseInit): Promise<ImageResponse> {
  const s = ALTAR_STRINGS[language];
  const row = await fetchPublishedAltarDay(day, dayLanguages(language)).catch(() => null);
  const content = {
    label: s.pageTitle,
    dateLabel: longDate(day, s.locale),
    verse: row?.scripture_text ?? null,
    reference: row?.scripture_ref ?? null,
    title: row?.title ?? null,
  };
  const drawn = Object.values(content).join("") + ALTAR_OG_BRAND + ALTAR_IMAGE_DOMAIN + "“”…KJV";
  const [regular, medium] = await Promise.all([loadNewsreader(drawn, 400), loadNewsreader(drawn, 500)]);
  const fonts = [
    ...(regular ? [{ name: "Newsreader", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(medium ? [{ name: "Newsreader", data: medium, weight: 500 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(renderAltarImage(content, day, format), { ...ALTAR_IMAGE_SIZES[format], ...(fonts.length ? { fonts } : {}), ...init });
}

export async function AltarPage({ language, focusDay }: { language: AltarLanguage; focusDay?: string }) {
  let all: FamilyAltarDay[] = [];
  try {
    all = await fetchPublishedAltarDays(dayLanguages(language), focusDay);
  } catch (err) {
    console.error("Family Altar load failed:", err);
  }
  return (
    <AltarView
      language={language}
      rows={all.filter((r) => r.language === language)}
      englishRows={language === "en" ? [] : all.filter((r) => r.language === "en")}
      focusDay={focusDay}
    />
  );
}
