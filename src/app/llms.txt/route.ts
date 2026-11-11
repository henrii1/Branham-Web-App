import { fetchAllPublishedSeoPages, type SeoCacheRow } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";

/**
 * Strip markdown to a short plain-text snippet suitable for the `: notes`
 * portion of an llms.txt list item. Keeps the line single-line and bounded.
 */
function snippet(md: string, maxChars = 160): string {
  const plain = md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  return plain.slice(0, maxChars - 1).trimEnd() + "…";
}

function buildLlmsTxt(pages: SeoCacheRow[]): string {
  const intro = [
    "# BranhamSermons.ai",
    "",
    "> BranhamSermons.ai (also known as Branham Sermons Assistant and Branham Sermons AI) is a free place to explore faith, study the Bible and search the sermons of William Marrion Branham. For anyone, whatever they believe, Christianity Seen in Nature is a series on what creation shows about God. For Christians, Bible search answers questions about Scripture from Scripture. For anyone looking into William Branham, Sermon search finds what he preached, with every quote cited by sermon date and paragraph.",
    "",
    "Where to start: Christianity Seen in Nature at `/faq/nature` (a series read in order); Bible search at `/chat?mode=bible`; Sermon search at `/chat?mode=sermons`; Questions of Faith (prepared answers) at `/faq`; a daily Family Altar devotion at `/altar`; all links at `/links`. Answer pages exist at `/q/{slug}` and are linked below; follow-up questions happen in the chat at `/chat`.",
    "",
    "## Supported Languages",
    "",
    "The assistant is fully multilingual. Answers, sermon passages, and the chat interface are available in the following languages:",
    "",
    "- **English** — full corpus (~1,200 sermons indexed). Chat at `/chat`; FAQ at `/faq`.",
    "- **Spanish (Español)** — 385 sermons indexed. Chat at `/chat`; FAQ at `/es/faq`; answer pages at `/es/q/{slug}`.",
    "- **French (Français)** — 359 sermons indexed. Chat at `/chat`; FAQ at `/fr/faq`; answer pages at `/fr/q/{slug}`.",
    "",
    "Language is detected from the user's profile or can be set interactively. Crawlers and LLMs indexing Spanish or French content should include the `/es/` and `/fr/` URL prefixes.",
    "",
  ];

  const questionLines = pages.map((p) => {
    const note = snippet(p.meta_description ?? p.answer_markdown);
    return `- [${p.question}](${SITE_URL}/q/${p.slug}): ${note}`;
  });

  const sections: string[] = [
    ...intro,
    "## Questions of Faith",
    "",
    ...questionLines,
    "",
    "## Resources",
    "",
    `- [Christianity Seen in Nature](${SITE_URL}/faq/nature): What creation shows about God, for anyone whatever they believe; read in order. Also at /es/faq/nature and /fr/faq/nature.`,
    `- [Chat](${SITE_URL}/chat): Bible search (answers from Scripture) and Sermon search (William Branham's sermons, every quote cited), in English, Spanish or French.`,
    `- [Questions of Faith — English](${SITE_URL}/faq): Browse the full set of curated Q&A pages in English.`,
    `- [Questions of Faith — Spanish / Preguntas de fe](${SITE_URL}/es/faq): Curated Q&A pages in Spanish.`,
    `- [Questions of Faith — French / Questions de foi](${SITE_URL}/fr/faq): Curated Q&A pages in French.`,
    `- [Family Altar](${SITE_URL}/altar): A short daily devotion for families. Also at /es/altar and /fr/altar.`,
    `- [About](${SITE_URL}/about): What the site is, where to start, and what it is not (not a church or a pastor, not a replacement for the full sermons). Also at /es/about and /fr/about.`,
    "",
    "## Optional",
    "",
    `- [Sitemap](${SITE_URL}/sitemap.xml): Machine-readable URL index.`,
    "",
  ];

  return sections.join("\n");
}

export async function GET() {
  try {
    const pages = await fetchAllPublishedSeoPages();
    const body = buildLlmsTxt(pages);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Cache for an hour at the edge; SEO pages don't churn often.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("Failed to build llms.txt:", err);
    return new Response("# BranhamSermons.ai\n\n> Service temporarily unavailable.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}