import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { ReferencePopover } from "@/components/chat/ReferencePopover";
import { applyCitations } from "@/lib/markdown/citations";
import {
  ABOUT_CONTENT,
  ABOUT_LANGS,
  aboutHref,
  type AboutLang,
} from "@/lib/about/content";

const SITE_URL = "https://branhamsermons.ai";
const TABLE_URL = "https://table.branham.org/";
const CONTACT_EMAIL = "info@branhamsermons.ai";

const LANG_NAMES: Record<AboutLang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

export function buildAboutMetadata(lang: AboutLang): Metadata {
  const c = ABOUT_CONTENT[lang];
  const url = `${SITE_URL}${aboutHref(lang)}`;
  return {
    title: { absolute: `${c.metaTitle} | Branham Sermons AI` },
    description: c.metaDescription,
    robots: { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE_URL}/about`,
        es: `${SITE_URL}/es/about`,
        fr: `${SITE_URL}/fr/about`,
        "x-default": `${SITE_URL}/about`,
      },
    },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url,
      type: "website",
      siteName: "Branham Sermons Assistant",
    },
  };
}

export function AboutPage({ lang }: { lang: AboutLang }) {
  const c = ABOUT_CONTENT[lang];
  const faqHref = lang === "en" ? "/faq" : `/${lang}/faq`;
  const langHrefs = { en: aboutHref("en"), es: aboutHref("es"), fr: aboutHref("fr") };

  // Static, first-party strings only — the same applyCitations() pass every
  // assistant answer goes through, so the pill carries the data-references
  // payload ReferencePopover needs to open the real paragraph.
  const evidenceHtml = applyCitations(
    `<p>${c.example.evidenceLabel}: [${c.example.citation}]</p>`,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: c.metaTitle,
    description: c.metaDescription,
    url: `${SITE_URL}${aboutHref(lang)}`,
    inLanguage: lang,
    about: {
      "@type": "Organization",
      name: "Branham Sermons Assistant",
      alternateName: "Branham Sermons AI",
      url: SITE_URL,
      email: CONTACT_EMAIL,
    },
  };

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
              <LangSwitcher current={lang} hrefs={langHrefs} />
              <Link
                href="/chat"
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {c.askQuestion}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <article
            lang={lang}
            className="mx-auto flex max-w-[41.5rem] flex-col gap-14 px-5 pt-10 pb-14 lg:gap-[4.5rem] lg:px-8 lg:pt-[4.5rem] lg:pb-[5.5rem]"
          >
            {/* ── What it is ── */}
            <div className="flex flex-col gap-[18px]">
              <h1 className="font-display text-[2rem] leading-[1.08] text-balance text-foreground lg:text-[2.875rem]">
                {c.title}
              </h1>
              <p className="text-lg leading-relaxed text-pretty text-zinc-600 dark:text-zinc-300">
                {c.lead}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                {c.availableIn}
                {ABOUT_LANGS.map((l) => (
                  <span
                    key={l}
                    className="rounded-full border border-zinc-200 bg-[var(--surface-base)] px-2.5 py-0.5 text-[12.5px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {LANG_NAMES[l]}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Why it exists ── */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.whyHeading}
              </h2>
              {c.whyParagraphs.map((p) => (
                <p key={p} className="text-[16.5px] leading-[1.72] text-foreground">
                  {p}
                </p>
              ))}
              <p className="font-display mt-3 text-2xl leading-[1.3] text-balance text-foreground before:mb-[18px] before:block before:h-0.5 before:w-10 before:bg-foreground before:content-[''] lg:text-[1.95rem]">
                {c.pullQuote}
              </p>
            </section>

            {/* ── Who it's for ── */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.whoHeading}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
                {c.who.map((item) => (
                  <li
                    key={item.label}
                    className="flex flex-col gap-1 border-t border-zinc-200 pt-3.5 pb-4 dark:border-zinc-700"
                  >
                    <b className="text-[15px] font-semibold text-foreground">{item.label}</b>
                    <span className="text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {item.body}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── What it does ── */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.doesHeading}
              </h2>
              <p className="text-lg leading-snug text-foreground">{c.principle}</p>

              <figure
                className="m-0 overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--surface-base)] dark:border-zinc-700"
                data-message-lang={lang}
              >
                <div className="flex justify-end px-4 pt-4">
                  <span className="max-w-[85%] rounded-2xl rounded-br-[4px] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-foreground">
                    {c.example.question}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 px-[18px] pt-3.5 pb-[18px]">
                  <blockquote className="font-display border-l-2 border-zinc-200 pl-3.5 text-base leading-relaxed text-zinc-600 italic dark:border-zinc-700 dark:text-zinc-300">
                    “{c.example.quote}”
                  </blockquote>
                  <div
                    className="text-sm text-foreground"
                    dangerouslySetInnerHTML={{ __html: evidenceHtml }}
                  />
                </div>
                <figcaption className="border-t border-zinc-200 bg-[var(--surface-soft)] px-[18px] py-2 text-[12.5px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {c.example.caption}
                </figcaption>
              </figure>

              <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {c.features.map((f) => (
                  <li key={f.label} className="flex flex-col gap-0.5">
                    <b className="text-[15px] font-semibold text-foreground">{f.label}</b>
                    <span className="text-[14.5px] text-zinc-600 dark:text-zinc-300">{f.body}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── What it is not ── */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.isntHeading}
              </h2>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-soft)] px-[18px] pt-[18px] pb-5">
                  <h3 className="font-display text-[19px] font-medium text-foreground">
                    {c.isntPastor.heading}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {c.isntPastor.body}
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-soft)] px-[18px] pt-[18px] pb-5">
                  <h3 className="font-display text-[19px] font-medium text-foreground">
                    {c.isntTable.heading}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {c.isntTable.body}
                  </p>
                  <a
                    href={TABLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {c.isntTable.linkLabel}
                  </a>
                </div>
              </div>
            </section>

            {/* ── What's ahead ── */}
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.aheadHeading}
              </h2>
              <p className="text-[16.5px] leading-[1.72] text-foreground">{c.aheadIntro}</p>
              <ul className="flex flex-col">
                {c.roadmap.map((r) => (
                  <li
                    key={r.label}
                    className="grid grid-cols-[22px_1fr] gap-3 border-t border-zinc-200 py-3 dark:border-zinc-700"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] ml-[5px] h-[9px] w-[9px] rounded-full border-[1.5px] border-zinc-400 dark:border-zinc-500"
                    />
                    <div>
                      <b className="block text-[15px] font-semibold text-foreground">{r.label}</b>
                      <span className="text-[14.5px] text-zinc-600 dark:text-zinc-300">{r.body}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{c.foundation}</p>
            </section>

            {/* ── Contact ── */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-[1.7rem] leading-tight text-balance text-foreground">
                {c.contactHeading}
              </h2>
              <p className="text-[15.5px] text-zinc-600 dark:text-zinc-300">{c.contactBody}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="w-fit text-[17px] font-medium text-foreground underline decoration-zinc-300 underline-offset-[5px] hover:decoration-zinc-500 dark:decoration-zinc-600"
              >
                {CONTACT_EMAIL}
              </a>
            </section>

            <div className="flex flex-wrap items-center gap-2.5 border-t border-zinc-200 pt-8 dark:border-zinc-700">
              <Link
                href="/chat"
                className="rounded-xl bg-zinc-900 px-[18px] py-[11px] text-[14.5px] font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {c.ctaChat}
              </Link>
              <Link
                href={faqHref}
                className="rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-[18px] py-[11px] text-[14.5px] font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {c.ctaFaq}
              </Link>
            </div>
          </article>
        </main>
      </div>

      {/* Opens the example citation's real paragraph via /api/reference. */}
      <ReferencePopover />
    </>
  );
}
