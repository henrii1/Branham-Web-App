import type { MetadataRoute } from "next";
import { fetchAllPublishedSeoPages } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";

// Rendered per request, not prerendered at build: FAQ entries are added
// from the admin UI, and a build-time sitemap would leave them out until
// the next deploy. (No persistent incremental cache is configured on
// Cloudflare, so revalidate-based ISR wouldn't refresh it either.)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [enPages, esPages, frPages] = await Promise.all([
    fetchAllPublishedSeoPages("en"),
    fetchAllPublishedSeoPages("es"),
    fetchAllPublishedSeoPages("fr"),
  ]);

  const enEntries: MetadataRoute.Sitemap = enPages.map((page) => ({
    url: `${SITE_URL}/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const esEntries: MetadataRoute.Sitemap = esPages.map((page) => ({
    url: `${SITE_URL}/es/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const frEntries: MetadataRoute.Sitemap = frPages.map((page) => ({
    url: `${SITE_URL}/fr/q/${page.slug}`,
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.7,
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
    {
      url: `${SITE_URL}/es/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/fr/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...(["/about", "/es/about", "/fr/about"] as const).map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    // The Christianity Seen in Nature series page.
    ...(["/faq/nature", "/es/faq/nature", "/fr/faq/nature"] as const).map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...enEntries,
    ...esEntries,
    ...frEntries,
  ];
}