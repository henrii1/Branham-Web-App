import type { Metadata } from "next";
import Link from "next/link";
import { ChatShell } from "@/components/chat/ChatShell";
import { fetchTopPublishedSeoPages } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

export const metadata: Metadata = {
  title: {
    absolute: "Branham Sermons Assistant — Ask Questions About Bro Branham's Sermons",
  },
  description:
    "Ask questions about the sermons of Bro. Branham. Find answers grounded in the original sermon texts, explore doctrines, quotes, Scripture references, and teachings.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/chat` },
  openGraph: {
    title: "Branham Sermons Assistant — Ask Questions About Bro Branham's Sermons",
    description:
      "Ask questions about the sermons of Bro. Branham. Find answers grounded in the original sermon texts, explore doctrines, quotes, and teachings.",
    url: `${SITE_URL}/chat`,
    type: "website",
    images: [{ url: OG_IMAGE }],
    siteName: "Branham Sermons Assistant",
  },
  twitter: {
    card: "summary_large_image",
    title: "Branham Sermons Assistant — Ask Questions About Bro Branham's Sermons",
    description:
      "Ask questions about the sermons of Bro. Branham. Find answers grounded in the original sermon texts, explore doctrines, quotes, and teachings.",
    images: [OG_IMAGE],
  },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ welcomeEmail?: string }>;
}) {
  const { welcomeEmail } = await searchParams;
  const topQuestions = await fetchTopPublishedSeoPages(8);

  return (
    <>
      {/* Crawlable entry point for search engines.
          Visually hidden; gives crawlers an h1, description, and links
          to /faq and top /q/ pages without changing the chat-first UI. */}
      <div className="sr-only" aria-hidden="true">
        <h1>Ask Questions About the Sermons of Bro. Branham</h1>
        <p>
          Branham Sermons AI answers questions about the sermons and teachings
          of William Marrion Branham, grounded in the original sermon texts.
          Explore doctrines, Scripture references, sermon quotes, and more.
        </p>
        <nav aria-label="Popular questions">
          <Link href="/faq">Browse all popular questions</Link>
          {topQuestions.map((q) => (
            <Link key={q.slug} href={`/q/${q.slug}`}>
              {q.question}
            </Link>
          ))}
        </nav>
      </div>
      <ChatShell triggerWelcomeEmail={welcomeEmail === "1"} />
    </>
  );
}
