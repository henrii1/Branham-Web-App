import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutPage, buildAboutMetadata } from "@/components/about/AboutPage";

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
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  return buildAboutMetadata(lang as SupportedLang);
}

export default async function LocalizedAboutPage({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  return <AboutPage lang={lang as SupportedLang} />;
}
