import { notFound } from "next/navigation";
import { BibleQuestionsPage } from "@/components/seo/BibleQuestionsPage";
import { bibleQuestionsMetadata } from "@/lib/faq/bibleQuestions";
import { fetchBibleTopics } from "@/lib/faq/bibleTopics";

export const metadata = bibleQuestionsMetadata("en");

/** Every Bible question, by topic: the fast way in (ready answers open instantly). */
export default async function BibleQuestionsRoute() {
  const { topics, natureCount } = await fetchBibleTopics("en");
  if (!topics.length) notFound();
  return <BibleQuestionsPage lang="en" topics={topics} natureCount={natureCount} />;
}
