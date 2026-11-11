import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { TodayVerse } from "@/components/site/TodayVerse";
import { FacebookIcon, InstagramIcon, MailIcon, TikTokIcon, WhatsAppIcon, XIcon } from "@/components/site/SocialIcons";
import { aboutHref } from "@/lib/about/content";
import { seriesPagePath } from "@/lib/faq/series";
import { BIBLE_QUESTIONS_ANCHOR } from "@/lib/faq/groups";
import { CONTACT_EMAIL, SOCIAL_LINKS, WHATSAPP_CHANNEL_URL } from "@/lib/site/social";
import { LINKS_COPY, linksHref, type LinksLang } from "@/lib/site/links";

const SITE_URL = "https://branhamsermons.ai";

export function buildLinksMetadata(lang: LinksLang): Metadata {
  const c = LINKS_COPY[lang];
  const url = `${SITE_URL}${linksHref(lang)}`;
  return {
    title: { absolute: c.metaTitle },
    description: c.tagline,
    alternates: {
      canonical: url,
      languages: { en: `${SITE_URL}/links`, es: `${SITE_URL}/es/links`, fr: `${SITE_URL}/fr/links`, "x-default": `${SITE_URL}/links` },
    },
    openGraph: { title: "BranhamSermons.ai", description: c.tagline, url, type: "website", siteName: "BranhamSermons.ai", locale: lang },
  };
}

const icon = "h-[18px] w-[18px]";

function PathIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--series-accent)]">
      <svg className={icon} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
        {children}
      </svg>
    </span>
  );
}

/**
 * The links page for the social media bios (our own Linktree). The WhatsApp
 * channel is the main way to stay connected, so it leads; today's Family
 * Altar verse is the page's centre; then one row per way in, in the site's
 * order (the nature series for anyone, the Bible, the sermons).
 */
export function LinksPage({ lang, natureCount }: { lang: LinksLang; natureCount: number }) {
  const c = LINKS_COPY[lang];
  const prefix = lang === "en" ? "" : `/${lang}`;
  const paths: { title: string; note: string; href: string; icon: ReactNode }[] = [
    {
      title: c.natureTitle,
      note: c.natureNote(natureCount),
      href: seriesPagePath(lang),
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Zm0 0 8-8" />,
    },
    {
      title: c.bibleTitle,
      note: c.bibleNote,
      href: "/chat?mode=bible",
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.3 8.4 4.75 5 4.75v13c3.4 0 5.5.55 7 1.75m0-13c1.5-1.2 3.6-1.75 7-1.75v13c-3.4 0-5.5.55-7 1.75m0-13v13" />,
    },
    {
      title: c.faqTitle,
      note: c.faqNote,
      href: `${prefix}/faq#${BIBLE_QUESTIONS_ANCHOR}`,
      icon: (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.5a2.25 2.25 0 1 1 3.1 2.08c-.5.2-.85.68-.85 1.22v.45M12 16.25h.01" />
        </>
      ),
    },
    {
      title: c.sermonsTitle,
      note: c.sermonsNote,
      href: "/chat?mode=sermons",
      icon: (
        <>
          <circle cx="11" cy="11" r="6" />
          <path strokeLinecap="round" d="m15.5 15.5 4 4" />
        </>
      ),
    },
  ];
  const socials = [
    { label: "Instagram", href: SOCIAL_LINKS.instagram, icon: <InstagramIcon /> },
    { label: "Facebook", href: SOCIAL_LINKS.facebook, icon: <FacebookIcon /> },
    { label: "TikTok", href: SOCIAL_LINKS.tiktok, icon: <TikTokIcon /> },
    { label: "X", href: SOCIAL_LINKS.x, icon: <XIcon /> },
    { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, icon: <MailIcon /> },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <main lang={lang} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[28rem] flex-col px-4 pt-5 pb-10">
        <div className="flex justify-end">
          <LangSwitcher current={lang} hrefs={{ en: linksHref("en"), es: linksHref("es"), fr: linksHref("fr") }} />
        </div>

        <header className="mt-2 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="" width={76} height={76} priority className="h-[76px] w-[76px] rounded-[22px] bg-white p-1.5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700" />
          <h1 className="font-display mt-4 text-[2rem] leading-none text-foreground">BranhamSermons.ai</h1>
          <p className="mt-2.5 max-w-[21rem] text-[15px] leading-snug text-pretty text-zinc-600 dark:text-zinc-300">{c.tagline}</p>
        </header>

        {/* The main way to stay connected. */}
        <a
          href={WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-3 rounded-2xl bg-[#1f7a4c] px-4 py-3.5 text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a4c]"
        >
          <WhatsAppIcon className="h-6 w-6 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-[15.5px] font-semibold">{c.channelButton}</span>
            <span className="text-[13px] text-white/85">{c.channelNote}</span>
          </span>
        </a>

        <TodayVerse lang={lang} copy={{ label: c.todayLabel, open: c.openDevotion, preparing: c.preparing }} />

        <nav aria-label={c.metaTitle} className="mt-7">
          <ul className="flex flex-col border-t border-zinc-200 dark:border-zinc-800">
            {paths.map((p) => (
              <li key={p.href} className="border-b border-zinc-200 dark:border-zinc-800">
                <Link
                  href={p.href}
                  className="group flex items-center gap-3.5 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--series-accent)]"
                >
                  <PathIcon>{p.icon}</PathIcon>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15.5px] font-medium text-foreground group-hover:underline group-hover:decoration-[var(--series-accent)] group-hover:underline-offset-4">{p.title}</span>
                    <span className="text-[13.5px] leading-snug text-zinc-500 dark:text-zinc-400">{p.note}</span>
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="mt-8 flex flex-col items-center gap-3">
          <h2 className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{c.followUs}</h2>
          <ul className="flex gap-2.5">
            {socials.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  {...(s.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                  aria-label={s.label}
                  title={s.label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-[var(--surface-base)] text-zinc-700 transition-colors hover:border-zinc-400 hover:text-foreground dark:border-zinc-700 dark:text-zinc-300"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <Link href={aboutHref(lang)} className="mt-8 self-center text-[13.5px] text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-foreground dark:text-zinc-400 dark:decoration-zinc-600">
          {c.about}
        </Link>
        </div>
      </main>
    </div>
  );
}
