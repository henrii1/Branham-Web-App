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
    "# Branham Sermons AI",
    "",
    "> Branham Sermons Assistant (a.k.a. Branham Sermons AI) is an AI-powered search and Q&A assistant for the messages, doctrines, and beliefs of William Marrion Branham. Every answer is grounded in the original sermon texts.",
    "",
    "The site lets visitors ask any question about Bro. Branham's teachings and receive an answer with cited passages from the original sermons. It covers Branham messages, doctrines, beliefs, Scripture references, sermon quotes, and biographical detail. Curated answer pages exist at `/q/{slug}` and are linked below; interactive follow-ups happen in the chat at `/chat`.",
    "",
  ];

  const questionLines = pages.map((p) => {
    const note = snippet(p.meta_description ?? p.answer_markdown);
    return `- [${p.question}](${SITE_URL}/q/${p.slug}): ${note}`;
  });

  const sections: string[] = [
    ...intro,
    "## Popular Questions",
    "",
    ...questionLines,
    "",
    "## Resources",
    "",
    `- [Chat interface](${SITE_URL}/chat): Ask any question about Bro. Branham's sermons; answers stream with cited passages.`,
    `- [Popular Questions index](${SITE_URL}/faq): Browse the full set of curated Q&A pages.`,
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
    return new Response("# Branham Sermons AI\n\n> Service temporarily unavailable.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}