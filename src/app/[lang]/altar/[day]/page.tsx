import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AltarPage, buildAltarDayMetadata } from "@/components/altar/altarPage";
import { isIsoDate } from "@/lib/altar/week";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string; day: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, day } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang) || !isIsoDate(day)) return { title: "Not Found" };
  return buildAltarDayMetadata(lang as SupportedLang, day);
}

export default async function LocalizedAltarDayPage({ params }: PageProps) {
  const { lang, day } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang) || !isIsoDate(day)) notFound();
  return <AltarPage language={lang as SupportedLang} focusDay={day} />;
}
