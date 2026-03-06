import type { Metadata } from "next";
import { fetchAllPublishedSeoPages } from "@/lib/db/seo-queries";
import { FaqAccordion } from "@/components/seo/FaqAccordion";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = "/og-image.png";

export const metadata: Metadata = {
  title: { absolute: "Frequently Asked Questions | Branham Sermons AI" },
  description:
    "Find answers to common questions about the sermons and teachings of William Marrion Branham, powered by AI search grounded in the original sermon texts.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "Frequently Asked Questions | Branham Sermons AI",
    description:
      "Find answers to common questions about the sermons and teachings of William Marrion Branham.",
    url: `${SITE_URL}/faq`,
    type: "website",
    images: [{ url: OG_IMAGE }],
    siteName: "Branham Sermons AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frequently Asked Questions | Branham Sermons AI",
    description:
      "Find answers to common questions about the sermons and teachings of William Marrion Branham.",
    images: [OG_IMAGE],
  },
};

function stripMarkdownToPlain(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getExcerpt(md: string, sentenceCount = 3): string {
  const plain = stripMarkdownToPlain(md);
  const sentences = plain.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return plain.slice(0, 200);
  return sentences.slice(0, sentenceCount).join(" ").trim();
}

export default async function FaqPage() {
  const pages = await fetchAllPublishedSeoPages();

  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    excerpt: getExcerpt(p.answer_markdown),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.excerpt,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <a
              href="/"
              className="text-sm font-semibold text-foreground"
            >
              Branham Sermons AI
            </a>
            <a
              href="/chat"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Ask a question
            </a>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="mb-2 text-2xl font-bold text-foreground lg:text-3xl">
            Frequently Asked Questions
          </h1>
          <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
            Common questions about the sermons and teachings of William Marrion
            Branham, answered from the original sermon texts.
          </p>

          <FaqAccordion items={faqItems} />
          </div>
        </main>
      </div>
    </>
  );
}
