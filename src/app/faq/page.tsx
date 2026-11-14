import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { redirect } from "next/navigation";
import { fetchFaqGroups, fetchFaqListItems } from "@/lib/db/seo-queries";
import { groupFaqItems } from "@/lib/faq/groups";
import { FaqGroups } from "@/components/seo/FaqGroups";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/site/SiteFooter";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

export const metadata: Metadata = {
  title: { absolute: "Questions of Faith | BranhamSermons.ai" },
  description:
    "Prepared answers to the questions people ask about God, the Bible and the teachings of William Marrion Branham, drawn from creation, the Scriptures and his own sermons.",
  keywords: [
    "Branham Sermons Assistant",
    "Branham Sermons AI",
    "Branham Sermons",
    "Branham messages",
    "William Branham Messages",
    "William Branham Doctrines",
    "William Branham Beliefs",
    "Branham",
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "Questions of Faith | BranhamSermons.ai",
    description:
      "Prepared answers to the questions people ask about God, the Bible and the teachings of William Marrion Branham, drawn from creation, the Scriptures and his own sermons.",
    url: `${SITE_URL}/faq`,
    type: "website",
    images: [{ url: OG_IMAGE }],
    siteName: "BranhamSermons.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Questions of Faith | BranhamSermons.ai",
    description:
      "Prepared answers to the questions people ask about God, the Bible and the teachings of William Marrion Branham, drawn from creation, the Scriptures and his own sermons.",
    images: [OG_IMAGE],
  },
};

export default async function FaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", user.id)
      .maybeSingle();
    const lang = profile?.language;
    if (lang === "es") redirect("/es/faq");
    if (lang === "fr") redirect("/fr/faq");
  }

  const [pages, groups] = await Promise.all([fetchFaqListItems("en"), fetchFaqGroups()]);
  const sections = groupFaqItems(pages, groups);

  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    metaDescription: p.meta_description,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.metaDescription ?? item.question,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex min-h-dvh flex-col bg-background">
        <SiteHeader lang="en" langHrefs={{ en: "/faq", es: "/es/faq", fr: "/fr/faq" }} tone="night" />

        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 py-10 xl:max-w-[56rem]">
            <h1 className="font-display mb-2 text-3xl text-foreground lg:text-4xl">
              Questions of Faith
            </h1>
            <p className="mb-8 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              Prepared answers to the questions people ask about God, the Bible and the teachings of William Marrion Branham, drawn from creation, the Scriptures and his own sermons.
            </p>

            <nav className="sr-only" aria-label="All questions">
              {faqItems.map((item) => (
                <Link key={item.slug} href={`/q/${item.slug}`}>
                  {item.question}
                </Link>
              ))}
            </nav>

            <FaqGroups nature={sections.nature} bible={sections.bible} doctrinal={sections.doctrinal} language="en" />

          </div>
          <SiteFooter language={"en"} />
        </main>
      </div>
    </>
  );
}