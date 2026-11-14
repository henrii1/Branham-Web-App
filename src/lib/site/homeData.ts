/**
 * What the home page, the site header and the Bible chat screen need from
 * the FAQ list, in one language: the nature series' parts and the Bible
 * questions' featured items. Server only (cached FAQ list queries).
 */

import { fetchFaqGroups, fetchFaqListItems } from "@/lib/db/seo-queries";
import { groupFaqItems, groupName } from "@/lib/faq/groups";
import { seriesOf } from "@/lib/faq/series";
import { HOME_FEATURED_GROUPS, HOME_TOPIC_GROUPS } from "./home";

export interface HomeQuestion {
  slug: string;
  question: string;
  group: string;
}

export interface HomeData {
  natureParts: { name: string; sample: HomeQuestion }[];
  natureCount: number;
  firstNature: HomeQuestion | null;
  bibleCount: number;
  bibleTopicCount: number;
  featuredBible: HomeQuestion[];
  bibleTopics: { id: string; name: string }[];
}

/** The question shown for each nature part on the home page: the part's own lead-in where it reads best. */
const NATURE_SAMPLE_INDEX = [3, 0, 3, 0, 0];

const byEnglishName = (names: string[]) => {
  const wanted = names.map((n) => n.toLowerCase());
  return <T extends { group: { name_en: string } | null }>(sections: T[]) =>
    wanted
      .map((w) => sections.find((s) => s.group?.name_en.toLowerCase() === w))
      .filter((s): s is T => !!s);
};

export async function fetchHomeData(lang: string): Promise<HomeData> {
  const [items, groups] = await Promise.all([fetchFaqListItems(lang), fetchFaqGroups()]);
  const sections = groupFaqItems(items, groups);
  const nature = sections.nature;
  const bible = sections.bible;
  const q = (s: { group: Parameters<typeof groupName>[0] | null }, item: { slug: string; question: string }): HomeQuestion => ({
    slug: item.slug,
    question: item.question,
    group: s.group ? groupName(s.group, lang) : "",
  });
  const series = seriesOf(nature);
  return {
    natureParts: nature.map((s, i) => ({
      name: s.group ? groupName(s.group, lang) : "",
      sample: q(s, s.items[Math.min(NATURE_SAMPLE_INDEX[i] ?? 0, s.items.length - 1)]),
    })),
    natureCount: series.length,
    firstNature: nature[0]?.items[0] ? q(nature[0], nature[0].items[0]) : null,
    bibleCount: bible.reduce((n, s) => n + s.items.length, 0),
    bibleTopicCount: bible.length,
    featuredBible: byEnglishName(HOME_FEATURED_GROUPS)(bible).map((s) => q(s, s.items[0])),
    bibleTopics: byEnglishName(HOME_TOPIC_GROUPS)(bible).map((s) => ({ id: s.group!.id, name: groupName(s.group!, lang) })),
  };
}
