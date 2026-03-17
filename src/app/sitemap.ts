import type { MetadataRoute } from "next";
import { fetchAllPublishedSeoPages } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await fetchAllPublishedSeoPages();

  const seoEntries: MetadataRoute.Sitemap = pages.map((page) => ({
    url: `${SITE_URL}/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: `${SITE_URL}/chat`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...seoEntries,
  ];
}
