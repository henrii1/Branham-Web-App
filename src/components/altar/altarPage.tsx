import type { Metadata } from "next";
import { AltarView } from "./AltarView";
import { fetchPublishedAltarDays } from "@/lib/altar/queries";
import { ALTAR_STRINGS, altarHref } from "@/lib/altar/strings";
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

export async function AltarPage({ language }: { language: AltarLanguage }) {
  let all: FamilyAltarDay[] = [];
  try {
    all = await fetchPublishedAltarDays(language === "en" ? ["en"] : [language, "en"]);
  } catch (err) {
    console.error("Family Altar load failed:", err);
  }
  return (
    <AltarView
      language={language}
      rows={all.filter((r) => r.language === language)}
      englishRows={language === "en" ? [] : all.filter((r) => r.language === "en")}
    />
  );
}
