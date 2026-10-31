import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchNatureSeries } from "@/lib/db/seo-queries";
import { NatureSeriesPage } from "@/components/seo/NatureSeriesPage";
import { natureSeriesMetadata } from "@/lib/faq/seriesMetadata";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return {};
  return natureSeriesMetadata(lang as SupportedLang);
}

export default async function NatureSeriesRoute({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;
  const sections = await fetchNatureSeries(l);
  if (!sections.length) notFound();
  return <NatureSeriesPage sections={sections} lang={l} />;
}
