import { fetchFaqGroups, fetchFaqListItems } from "@/lib/db/seo-queries";
import { groupFaqItems, groupName } from "./groups";
import { seriesOf } from "./series";
import type { BibleTopic } from "@/components/seo/BibleQuestionsList";

/** Bible questions by topic (group creation order) and the nature series length, in one language. Server only. */
export async function fetchBibleTopics(lang: string): Promise<{ topics: BibleTopic[]; natureCount: number }> {
  const [items, groups] = await Promise.all([fetchFaqListItems(lang), fetchFaqGroups()]);
  const sections = groupFaqItems(items, groups);
  return {
    topics: sections.bible.map((s) => ({
      id: s.group!.id,
      name: groupName(s.group!, lang),
      items: s.items.map((i) => ({ slug: i.slug, question: i.question })),
    })),
    natureCount: seriesOf(sections.nature).length,
  };
}
