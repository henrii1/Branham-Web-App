import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AltarPage, buildAltarMetadata } from "@/components/altar/altarPage";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  return buildAltarMetadata(lang as SupportedLang);
}

export default async function LocalizedAltarPage({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  return <AltarPage language={lang as SupportedLang} />;
}
