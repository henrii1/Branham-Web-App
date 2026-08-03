import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchAdjacentSeoPages,
  fetchAllPublishedSeoPages,
  fetchSeoPage,
} from "@/lib/db/seo-queries";
import { SeoShell } from "@/components/seo/SeoShell";
import { renderMarkdown } from "@/lib/markdown/render";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";

const SITE_URL = "https://branhamsermons.ai";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateStaticParams() {
  const results: { lang: string; slug: string }[] = [];
  for (const lang of SUPPORTED_LANGS) {
    const pages = await fetchAllPublishedSeoPages(lang);
    for (const page of pages) {
      results.push({ lang, slug: page.slug });
    }
  }
  return results;
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const l = lang as SupportedLang;

  const page = await fetchSeoPage(slug, l);
  if (!page) return { title: "Not Found" };

  const title = page.meta_title || `${page.question} | Branham Sermons Assistant`;
  const description =
    page.meta_description || stripMarkdownToPlain(page.answer_markdown).slice(0, 155);
  const canonicalUrl = `${SITE_URL}/${l}/q/${slug}`;

  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${SITE_URL}/q/${slug}`,
        es: `${SITE_URL}/es/q/${slug}`,
        fr: `${SITE_URL}/fr/q/${slug}`,
        "x-default": `${SITE_URL}/q/${slug}`,
      },
    },
    // No explicit `images` here — Next.js auto-detects the per-slug
    // opengraph-image.tsx route in this same directory and injects its
    // URL into openGraph/twitter metadata automatically. An explicit
    // `images` key here would silently override that with a stale value.
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "Branham Sermons Assistant",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocalizedSeoQuestionPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;

  const [page, adjacent] = await Promise.all([
    fetchSeoPage(slug, l),
    fetchAdjacentSeoPages(slug, l),
  ]);

  if (!page) notFound();

  const canonicalUrl = `${SITE_URL}/${l}/q/${slug}`;
  const prevUrl = adjacent.prev ? `${SITE_URL}/${l}/q/${adjacent.prev.slug}` : null;
  const nextUrl = adjacent.next ? `${SITE_URL}/${l}/q/${adjacent.next.slug}` : null;
  const answerPlain = stripMarkdownToPlain(page.answer_markdown);
  const ogImageUrl = `${canonicalUrl}/opengraph-image`;

  const appOrg = { "@type": "Organization", name: "Branham Sermons AI", url: SITE_URL };

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.question,
    description: page.meta_description || answerPlain.slice(0, 155),
    articleBody: answerPlain,
    inLanguage: l,
    datePublished: page.created_at,
    dateModified: page.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    image: ogImageUrl,
    author: appOrg,
    publisher: {
      "@type": "Organization",
      name: "Branham Sermons AI",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 1024, height: 1024 },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/chat` },
      { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE_URL}/${l}/faq` },
      { "@type": "ListItem", position: 3, name: page.question, item: canonicalUrl },
    ],
  };

  const processedAnswer = postprocessChatResponse(page.answer_markdown);
  const ssrAnswerHtml = renderMarkdown(processedAnswer);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
      <div
        className="sr-only"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ssrAnswerHtml }}
      />
      <SeoShell
        slug={slug}
        question={page.question}
        answerMarkdown={page.answer_markdown}
        ragContext={page.rag_context ?? ""}
        retrievalQuery={page.robust_query}
        conversationSummary={page.conversation_summary}
        nextPage={adjacent.next}
        language={l}
        langHrefs={{
          en: `/q/${slug}`,
          es: `/es/q/${slug}`,
          fr: `/fr/q/${slug}`,
        }}
      />
    </>
  );
}