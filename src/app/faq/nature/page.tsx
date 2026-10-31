import { notFound } from "next/navigation";
import { fetchNatureSeries } from "@/lib/db/seo-queries";
import { natureSeriesMetadata } from "@/lib/faq/seriesMetadata";
import { NatureSeriesPage } from "@/components/seo/NatureSeriesPage";

export const metadata = natureSeriesMetadata("en");

/** Christianity Seen in Nature on its own page, so it can be shared as one link. */
export default async function NatureSeriesRoute() {
  const sections = await fetchNatureSeries("en");
  if (!sections.length) notFound();
  return <NatureSeriesPage sections={sections} lang="en" />;
}
