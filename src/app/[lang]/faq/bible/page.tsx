import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BibleQuestionsPage } from "@/components/seo/BibleQuestionsPage";
import { bibleQuestionsMetadata } from "@/lib/faq/bibleQuestions";
import { fetchBibleTopics } from "@/lib/faq/bibleTopics";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return {};
  return bibleQuestionsMetadata(lang as SupportedLang);
}

export default async function LocalizedBibleQuestionsRoute({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;
  const { topics, natureCount } = await fetchBibleTopics(l);
  if (!topics.length) notFound();
  return <BibleQuestionsPage lang={l} topics={topics} natureCount={natureCount} />;
}
