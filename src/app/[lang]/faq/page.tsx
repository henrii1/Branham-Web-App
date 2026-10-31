import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { fetchFaqGroups, fetchFaqListItems } from "@/lib/db/seo-queries";
import { groupFaqItems } from "@/lib/faq/groups";
import { FaqGroups } from "@/components/seo/FaqGroups";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { SiteFooter } from "@/components/site/SiteFooter";

const SITE_URL = "https://branhamsermons.ai";
const OG_IMAGE = `${SITE_URL}/opengraph-image`;

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_META: Record<
  SupportedLang,
  { title: string; description: string; label: string; subtitle: string }
> = {
  es: {
    title: "Preguntas frecuentes sobre el Hno. Branham | Branham Sermons Assistant",
    description:
      "Preguntas comunes sobre las doctrinas, sermones, biografía y creencias de William Marrion Branham, respondidas desde los textos originales de los sermones.",
    label: "Preguntas frecuentes",
    subtitle:
      "Preguntas sobre Dios y el cristianismo visto en la naturaleza, lo que enseña la Biblia y las enseñanzas de William Marrion Branham, respondidas desde la creación, las Escrituras y sus sermones originales.",
  },
  fr: {
    title: "Questions fréquentes sur Frère Branham | Branham Sermons Assistant",
    description:
      "Questions courantes sur les doctrines, sermons, biographie et croyances de William Marrion Branham, répondues à partir des textes originaux des sermons.",
    label: "Questions fréquentes",
    subtitle:
      "Questions sur Dieu et le christianisme vu dans la nature, sur ce qu’enseigne la Bible et sur les enseignements de William Marrion Branham, avec des réponses tirées de la création, des Écritures et de ses sermons originaux.",
  },
};

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const l = lang as SupportedLang;
  const meta = LANG_META[l];
  return {
    title: { absolute: meta.title },
    description: meta.description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${SITE_URL}/${l}/faq`,
      languages: {
        en: `${SITE_URL}/faq`,
        es: `${SITE_URL}/es/faq`,
        fr: `${SITE_URL}/fr/faq`,
        "x-default": `${SITE_URL}/faq`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}/${l}/faq`,
      type: "website",
      images: [{ url: OG_IMAGE }],
      siteName: "Branham Sermons Assistant",
    },
  };
}

export default async function LocalizedFaqPage({ params }: PageProps) {
  const { lang } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();
  const l = lang as SupportedLang;

  const [pages, groups] = await Promise.all([fetchFaqListItems(l), fetchFaqGroups()]);
  const sections = groupFaqItems(pages, groups);
  const faqItems = pages.map((p) => ({
    slug: p.slug,
    question: p.question,
    metaDescription: p.meta_description,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: l,
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.metaDescription ?? item.question,
      },
    })),
  };

  const langHrefs = { en: "/faq", es: "/es/faq", fr: "/fr/faq" };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 xl:max-w-[56rem]">
            <BrandLogo href="/" priority />
            <div className="flex items-center gap-2">
              <LangSwitcher current={l} hrefs={langHrefs} />
              <Link
                href="/chat"
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Ask a question
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-10 xl:max-w-[56rem]">
            <h1 className="font-display mb-2 text-3xl text-foreground lg:text-4xl">
              {LANG_META[l].label}
            </h1>
            <p className="mb-8 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              {LANG_META[l].subtitle}
            </p>

            <nav className="sr-only" aria-label="All questions">
              {faqItems.map((item) => (
                <Link key={item.slug} href={`/${l}/q/${item.slug}`}>
                  {item.question}
                </Link>
              ))}
            </nav>

            <FaqGroups nature={sections.nature} bible={sections.bible} doctrinal={sections.doctrinal} language={l} slugPrefix={`/${l}/q`} />

          </div>
          <SiteFooter language={l} />
        </main>
      </div>
    </>
  );
}