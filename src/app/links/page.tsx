import { LinksPage, buildLinksMetadata } from "@/components/site/LinksPage";
import { fetchNatureSeries } from "@/lib/db/seo-queries";
import { seriesOf } from "@/lib/faq/series";

export const metadata = buildLinksMetadata("en");

/** The address in the social media bios (in place of Linktree). */
export default async function LinksRoute() {
  const nature = await fetchNatureSeries("en");
  return <LinksPage lang="en" natureCount={seriesOf(nature).length} />;
}
