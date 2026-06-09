import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchAdjacentSeoPages, fetchSeoPage } from "@/lib/db/seo-queries";
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
  const [page, adjacent] = await Promise.all([
    fetchSeoPage(slug),
    fetchAdjacentSeoPages(slug),
  ]);

  if (!page) {
    notFound();
  }

  const canonicalUrl = `${SITE_URL}/q/${slug}`;
  const prevUrl = adjacent.prev ? `${SITE_URL}/q/${adjacent.prev.slug}` : null;
  const nextUrl = adjacent.next ? `${SITE_URL}/q/${adjacent.next.slug}` : null;
  const answerPlain = stripMarkdownToPlain(page.answer_markdown);

  const appOrg = {
    "@type": "Organization",
    name: "Branham Sermons AI",
    url: SITE_URL,
  };

  // Article — NOT QAPage. QAPage is reserved by Google for pages with
  // user-submitted answers (forums/community Q&A); using it for a single
  // site-authored answer violates the QAPage usage policy and fails Rich
  // Results validation. Article is the correct type for an authored answer
  // and carries the freshness signal (dateModified) Google wants.
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.question,
    description: page.meta_description || answerPlain.slice(0, 155),
    articleBody: answerPlain,
    inLanguage: page.language || "en",
    datePublished: page.created_at,
    dateModified: page.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    image: OG_IMAGE,
    author: appOrg,
    publisher: {
      "@type": "Organization",
      name: "Branham Sermons AI",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 1024,
        height: 1024,
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
        item: canonicalUrl,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* rel=prev/next help non-Google engines build the site graph and give
          Googlebot extra discovery links for adjacent /q pages — a known
          remedy for "crawled — currently not indexed" leaf pages. */}
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
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
        nextPage={adjacent.next}
      />
    </>
  );
}
