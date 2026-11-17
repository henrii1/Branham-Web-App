import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage, buildHomeMetadata } from "@/components/home/HomePage";
import { fetchHomeData } from "@/lib/site/homeData";
import { fetchHomeVideos } from "@/lib/site/youtube";

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
  return buildHomeMetadata(lang as SupportedLang);
}

/** The home page in French or Spanish. */
export default async function LocalizedHome({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;
  const [data, videos] = await Promise.all([fetchHomeData(l), fetchHomeVideos()]);
  return <HomePage lang={l} data={data} videos={videos} />;
}
