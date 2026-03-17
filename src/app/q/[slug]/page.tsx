import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchSeoPage } from "@/lib/db/seo-queries";
import { SeoShell } from "@/components/seo/SeoShell";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

interface PageProps {
  params: Promise<{ slug: string }>;
}

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

function getFirst300Words(md: string): string {
  const plain = stripMarkdownToPlain(md);
  const words = plain.split(/\s+/);
  return words.slice(0, 300).join(" ");
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchSeoPage(slug);

  if (!page) {
    return { title: "Not Found" };
  }

  const title = page.meta_title || `${page.question} | Branham Sermons Assistant`;
  const description =
    page.meta_description || stripMarkdownToPlain(page.answer_markdown).slice(0, 155);
  const canonicalUrl = `${SITE_URL}/q/${slug}`;

  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: [{ url: OG_IMAGE }],
      siteName: "Branham Sermons Assistant",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

export default async function SeoQuestionPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchSeoPage(slug);

  if (!page) {
    notFound();
  }

  const answerPlainExcerpt = getFirst300Words(page.answer_markdown);

  const qaPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: page.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerPlainExcerpt,
      },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/chat`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "FAQ",
        item: `${SITE_URL}/faq`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.question,
        item: `${SITE_URL}/q/${slug}`,
      },
    ],
  };

  const processedAnswer = postprocessChatResponse(page.answer_markdown);
  const ssrAnswerHtml = renderMarkdown(processedAnswer);

  return (
    <>
      {/* Each structured data type in its own script tag — required by Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(qaPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Full answer rendered server-side for search crawlers.
          Visually hidden; identical to what users see after the typewriter animation. */}
      <div
        className="sr-only"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ssrAnswerHtml }}
      />
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context}
        conversationSummary={page.conversation_summary}
      />
    </>
  );
}
