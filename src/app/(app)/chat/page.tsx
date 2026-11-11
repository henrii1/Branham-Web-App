import { POSITIONING, SITE_TITLE } from "@/lib/site/positioning";
import type { Metadata } from "next";
import Link from "next/link";
import { ChatShell } from "@/components/chat/ChatShell";
import { fetchTopPublishedSeoPages } from "@/lib/db/seo-queries";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: POSITIONING.en.medium,
  keywords: [
    "Branham Sermons Assistant",
    "Branham Sermons AI",
    "Branham Sermons search",
    "Branham Sermons",
    "Branham messages",
    "William Branham Messages",
    "William Branham Doctrines",
    "William Branham Beliefs",
    "Branham",
    "Bible study",
    "Bible questions and answers",
    "Christianity seen in nature",
    "does God exist",
    "Branham en español",
    "Branham en français",
    "sermones de Branham",
    "sermons de Branham",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/chat` },
  openGraph: {
    title: SITE_TITLE,
    description: POSITIONING.en.medium,
    url: `${SITE_URL}/chat`,
    type: "website",
    images: [{ url: OG_IMAGE }],
    siteName: "BranhamSermons.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: POSITIONING.en.medium,
    images: [OG_IMAGE],
  },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ welcomeEmail?: string; mode?: string }>;
}) {
  const { welcomeEmail, mode } = await searchParams;
  const topQuestions = await fetchTopPublishedSeoPages(8);

  return (
    <>
      {/* Crawlable entry point for search engines.
          Visually hidden; gives crawlers an h1, description, and links
          to /faq and top /q/ pages without changing the chat-first UI. */}
      <div className="sr-only" aria-hidden="true">
        <h1>Explore Faith, Study the Bible, Search the Sermons of William Branham</h1>
        <p>
          BranhamSermons.ai is a free place to explore faith, study the Bible
          and search the sermons of William Marrion Branham. Christianity Seen
          in Nature looks at what creation shows about God, for anyone
          whatever they believe. Bible search answers questions about Scripture
          from Scripture. Sermon search finds what Brother Branham preached,
          with every quote cited. Available in English, Spanish (Español) and
          French (Français): sermones de Branham, sermons de Branham.
        </p>
        <nav aria-label="Questions of Faith">
          <Link href="/faq/nature">Christianity Seen in Nature</Link>
          <Link href="/faq">Browse Questions of Faith</Link>
          {topQuestions.map((q) => (
            <Link key={q.slug} href={`/q/${q.slug}`}>
              {q.question}
            </Link>
          ))}
        </nav>
      </div>
      <ChatShell
        triggerWelcomeEmail={welcomeEmail === "1"}
        initialSearchMode={mode === "bible" || mode === "sermons" ? mode : undefined}
      />
    </>
  );
}
