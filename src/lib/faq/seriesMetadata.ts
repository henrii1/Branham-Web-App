import type { Metadata } from "next";
import { SECTION_LABELS } from "./groups";
import { seriesCopy, seriesPagePath } from "./series";

const SITE_URL = "https://branhamsermons.ai";

/** Title, description and alternates for the series page in one language. */
export function natureSeriesMetadata(lang: "en" | "es" | "fr"): Metadata {
  const title = `${SECTION_LABELS.nature[lang]} | Branham Sermons Assistant`;
  const description = seriesCopy(lang).metaDescription;
  const url = `${SITE_URL}${seriesPagePath(lang)}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { en: `${SITE_URL}${seriesPagePath("en")}`, es: `${SITE_URL}${seriesPagePath("es")}`, fr: `${SITE_URL}${seriesPagePath("fr")}` },
    },
    // The preview image comes from opengraph-image.tsx in this route; an
    // explicit images value here would override it.
    openGraph: { title, description, url, type: "website", siteName: "Branham Sermons Assistant", locale: lang },
    twitter: { card: "summary_large_image", title, description },
  };
}
