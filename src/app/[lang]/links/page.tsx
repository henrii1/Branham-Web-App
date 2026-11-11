import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinksPage, buildLinksMetadata } from "@/components/site/LinksPage";
import { fetchNatureSeries } from "@/lib/db/seo-queries";
import { seriesOf } from "@/lib/faq/series";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return {};
  return buildLinksMetadata(lang as SupportedLang);
}

export default async function LocalizedLinksRoute({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;
  const nature = await fetchNatureSeries(l);
  return <LinksPage lang={l} natureCount={seriesOf(nature).length} />;
}
