import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { WhatsAppIcon, YouTubeIcon } from "@/components/site/SocialIcons";
import { HomeAltarCard } from "./HomeAltarCard";
import { VideoCard } from "./VideoCard";
import { seriesPagePath } from "@/lib/faq/series";
import { HOME_COPY, bibleQuestionsHref, chatHref } from "@/lib/site/home";
import type { HomeData } from "@/lib/site/homeData";
import { homeHref, type SiteLang } from "@/lib/site/siteLanguage";
import { WHATSAPP_CHANNEL_URL, YOUTUBE_CHANNEL_URL } from "@/lib/site/social";
import type { YouTubeVideo } from "@/lib/site/youtube";

const SITE_URL = "https://branhamsermons.ai";
const LANG_HREFS = { en: homeHref("en"), fr: homeHref("fr"), es: homeHref("es") };

export function buildHomeMetadata(lang: SiteLang): Metadata {
  const c = HOME_COPY[lang];
  const url = `${SITE_URL}${lang === "en" ? "" : `/${lang}`}`;
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: {
      canonical: url,
      languages: { en: SITE_URL, fr: `${SITE_URL}/fr`, es: `${SITE_URL}/es`, "x-default": SITE_URL },
    },
    openGraph: { title: c.heroTitle, description: c.metaDescription, url, type: "website", siteName: "BranhamSermons.ai", locale: lang },
    twitter: { card: "summary_large_image", title: c.heroTitle, description: c.metaDescription },
  };
}

const qHref = (lang: SiteLang, slug: string) => (lang === "en" ? `/q/${slug}` : `/${lang}/q/${slug}`);

/**
 * The home page, built for evangelism. It reads from night to day: the night
 * sky and the nature series for anyone, whatever they believe; the films as
 * the sky turns; then daylight for believers who want to grow (Bible
 * questions first, since ready answers are instant; Family Altar; the
 * WhatsApp channel); and last, quietly, the sermon search. Doctrinal
 * questions are never shown here.
 */
export function HomePage({ lang, data, videos }: { lang: SiteLang; data: HomeData; videos: YouTubeVideo[] }) {
  const c = HOME_COPY[lang];
  const seriesHref = seriesPagePath(lang);
  const startHref = data.firstNature ? qHref(lang, data.firstNature.slug) : seriesHref;

  return (
    <div lang={lang} className="min-h-dvh bg-[var(--home-day)] text-foreground">
      {/* ── Night: for anyone ─────────────────────────────── */}
      <section className="relative flex min-h-[100svh] items-end bg-[var(--home-night)] text-[#edf0e8]">
        <picture>
          <source media="(max-width: 767px)" srcSet="/home/night-sky-sm.jpg" />
          <img src="/home/night-sky.jpg" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[62%_40%] [filter:saturate(.62)] md:object-[58%_40%]" />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,17,.5)_0%,rgba(9,13,17,.1)_22%,rgba(9,13,17,.72)_52%,rgba(11,29,22,.94)_86%,var(--home-night)_100%)] md:bg-[linear-gradient(180deg,rgba(9,13,17,.55)_0%,rgba(9,13,17,0)_28%,rgba(9,13,17,0)_50%,rgba(11,29,22,.9)_88%,var(--home-night)_100%),linear-gradient(90deg,rgba(9,13,17,.7)_0%,rgba(9,13,17,0)_55%)]" />
        <SiteHeader lang={lang} langHrefs={LANG_HREFS} tone="night" overlay natureCount={data.natureCount} bibleCount={data.bibleCount} />
        <div className="relative mx-auto w-full max-w-[72rem] px-4 pt-28 pb-14 sm:px-6 md:pb-20 [@media(max-height:760px)]:pt-24 [@media(max-height:760px)]:pb-10">
          <h1 className="home-rise font-display max-w-[11ch] text-[clamp(2.5rem,min(7.4vw,11.5svh),6rem)] leading-[0.98] font-normal tracking-[-0.025em] text-balance">
            {c.heroTitle}
          </h1>
          <p className="home-rise mt-6 max-w-[34rem] text-[17px] leading-relaxed text-[#edf0e8]/85 [animation-delay:150ms] md:text-[19px] [@media(max-height:760px)]:mt-4 [@media(max-height:760px)]:text-[16.5px]">{c.heroLede}</p>
          <div className="home-rise mt-8 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row [@media(max-height:760px)]:mt-6">
            <Link prefetch={false} href={startHref} className="flex h-[52px] items-center justify-center rounded-full bg-[var(--home-leaf)] px-6 text-[16px] font-medium text-[var(--home-night)] transition-colors hover:bg-[#a6d2b2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-leaf)]">
              {c.heroStart}
            </Link>
            <Link prefetch={false} href={seriesHref} className="flex h-[52px] items-center justify-center rounded-full border border-white/40 px-6 text-[16px] font-medium transition-colors hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {c.heroAll(data.natureCount)}
            </Link>
          </div>
          {data.firstNature && (
            <p className="mt-10 flex max-w-[40rem] [@media(max-height:760px)]:mt-6 flex-col gap-1 text-[14px] text-[#edf0e8]/70 sm:flex-row sm:items-baseline sm:gap-3.5">
              <span className="font-medium text-[var(--home-leaf)]">{c.firstQuestionLabel}</span>
              <Link prefetch={false} href={startHref} className="font-display text-[19px] italic text-[#edf0e8] hover:underline hover:underline-offset-4">
                {data.firstNature.question}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* The series as a path: five parts, in order. */}
      <section className="-mt-px bg-[var(--home-night)] pt-10 pb-24 text-[#edf0e8] md:pb-28">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-6">
          <h2 className="font-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-normal tracking-[-0.015em]">{c.seriesTitle}</h2>
          <p className="mt-3.5 max-w-[36rem] leading-relaxed text-[#edf0e8]/72">{c.seriesIntro(data.natureParts.length)}</p>
          <ol className="relative mt-12 grid grid-cols-1 md:grid-cols-5">
            <span aria-hidden="true" className="absolute top-2 bottom-8 left-[7px] w-px bg-gradient-to-b from-white/25 to-[var(--home-leaf)] md:top-[7px] md:right-2 md:bottom-auto md:left-2 md:h-px md:w-auto md:bg-gradient-to-r" />
            {data.natureParts.map((p, i) => {
              const last = i === data.natureParts.length - 1;
              return (
                <li key={p.name} className="relative pb-8 pl-9 md:pt-9 md:pr-5 md:pb-0 md:pl-0">
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 left-0 h-[15px] w-[15px] rounded-full border-[1.5px] md:top-0 ${
                      last ? "border-[var(--home-leaf)] bg-[var(--home-leaf)] shadow-[0_0_0_6px_rgba(143,194,158,.2)]" : "border-white/50 bg-[var(--home-night)]"
                    }`}
                  />
                  <span className="text-[13px] text-[#edf0e8]/55">{c.partLabel(i + 1)}</span>
                  <h3 className="font-display mt-1 text-[21px] leading-tight font-medium">{p.name}</h3>
                  <Link prefetch={false} href={qHref(lang, p.sample.slug)} className="mt-2.5 block text-[14.5px] leading-normal text-[#edf0e8]/72 hover:text-white hover:underline hover:underline-offset-4">
                    {p.sample.question}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Dawn: the films ────────────────────────────────── */}
      <section id="videos" className="-mt-px scroll-mt-4 bg-[linear-gradient(180deg,var(--home-night)_0%,#14352a_40%,#2c5a40_72%,#5d8c66_100%)] py-24 dark:bg-[linear-gradient(180deg,var(--home-night)_0%,#123026_45%,#1f4130_100%)] text-[#edf0e8] md:py-28">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-normal tracking-[-0.015em]">{c.videosTitle}</h2>
              <p className="mt-3.5 max-w-[34rem] leading-relaxed text-[#edf0e8]/78">{c.videosIntro}</p>
            </div>
            {videos.length > 0 && (
              <a href={videos[0].file ? `${YOUTUBE_CHANNEL_URL}?sub_confirmation=1` : YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-b border-white/50 pb-0.5 text-[15px] font-medium hover:border-white">
                <YouTubeIcon className="h-5 w-5" />
                {/* our own films (channel still empty): invite to subscribe rather than "more" */}
                {videos[0].file ? c.videosEmptyButton : c.videosMore}
              </a>
            )}
          </div>
          {videos.length > 0 && videos.some((v) => v.short) ? (
            /* Shorts: upright, side by side (a swipeable row on phones) */
            <div className="-mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:mx-auto lg:max-w-[56rem]">
              {videos.map((v) => (
                <div key={v.id} className="w-[68%] shrink-0 snap-center sm:w-auto">
                  <VideoCard id={v.id} title={v.title} upright />
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className={`mt-12 grid gap-5 ${videos.length > 1 ? "lg:grid-cols-[1.7fr_1fr]" : ""}`}>
              {videos.map((v, i) => (
                <VideoCard key={v.id} id={v.id} title={v.title} file={v.file} big={i === 0 && videos.length > 2} />
              ))}
            </div>
          ) : (
            <div className="mt-12 flex flex-col items-start gap-5 rounded-2xl border border-white/15 bg-white/5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
              <div>
                <p className="font-display text-[1.6rem] leading-tight">{c.videosEmptyTitle}</p>
                <p className="mt-2 text-[15px] text-[#edf0e8]/75">{c.videosEmptyBody}</p>
              </div>
              <a href={`${YOUTUBE_CHANNEL_URL}?sub_confirmation=1`} target="_blank" rel="noopener noreferrer" className="flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-white px-5 text-[15px] font-medium text-[var(--home-night)] hover:bg-[#edf0e8]">
                <YouTubeIcon className="h-5 w-5 text-[#d6281e]" />
                {c.videosEmptyButton}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Day: believers who want to grow ────────────────── */}
      <section className="-mt-px bg-[linear-gradient(180deg,#5d8c66_0,#bcd6c0_150px,var(--home-day)_430px)] pt-24 pb-24 dark:bg-[linear-gradient(180deg,#1f4130_0,#1b2c22_200px,var(--home-day)_430px)] md:pt-28">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-6">
          <h2 className="font-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-normal tracking-[-0.015em] text-[#14211a] dark:text-[#edf0e8]">{c.growTitle}</h2>
          <p className="mt-3.5 max-w-[36rem] text-[17px] leading-relaxed text-[#46524b] dark:text-zinc-300">{c.growIntro}</p>
          <div className="mt-12 grid items-start gap-7 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-[22px] border-t-4 border-[var(--home-meadow)] bg-[var(--home-card)] p-6 shadow-[0_1px_0_rgba(27,36,32,.06),0_18px_40px_-24px_rgba(27,36,32,.25)] sm:p-9 dark:border-[var(--home-leaf)]">
              <h3 className="font-display text-[1.9rem] leading-tight font-medium">{c.bibleTitle}</h3>
              <p className="mt-1.5 text-[15px] text-zinc-500 dark:text-zinc-400">{c.bibleMeta(data.bibleCount)}</p>
              <ul className="mt-6 border-t border-[var(--home-line)]">
                {data.featuredBible.map((q) => (
                  <li key={q.slug} className="border-b border-[var(--home-line)]">
                    <Link prefetch={false} href={qHref(lang, q.slug)} className="flex items-baseline justify-between gap-4 py-3.5 text-[16.5px] hover:text-[var(--home-meadow)] dark:hover:text-[var(--home-leaf)]">
                      {q.question}
                      <small className="hidden shrink-0 text-[13px] text-zinc-500 sm:inline dark:text-zinc-400">{q.group}</small>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                {data.bibleTopics.map((t) => (
                  <Link key={t.id} prefetch={false} href={`${bibleQuestionsHref(lang)}#topic-${t.id}`} className="rounded-full bg-[var(--home-chip)] px-3.5 py-1.5 text-[13.5px] text-[var(--home-chip-text)] hover:brightness-95">
                    {t.name}
                  </Link>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                <Link prefetch={false} href={bibleQuestionsHref(lang)} className="flex h-12 items-center rounded-full bg-[var(--home-meadow)] px-6 text-[15.5px] font-medium text-white hover:bg-[#265a39]">
                  {c.bibleBrowse}
                </Link>
                <span className="text-[14.5px] text-zinc-500 dark:text-zinc-400">
                  {c.bibleCantFind}{" "}
                  <Link prefetch={false} href={chatHref("bible")} className="border-b border-zinc-400 text-foreground hover:border-current">
                    {c.askBible}
                  </Link>
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-7">
              <HomeAltarCard lang={lang} copy={{ label: c.altarLabel, open: c.altarOpen, preparing: c.altarPreparing }} />
              <div className="rounded-[22px] bg-[#1f7a4c] p-7 text-white">
                <h3 className="font-display text-[1.6rem] leading-tight font-medium">{c.channelTitle}</h3>
                <p className="mt-2.5 text-[15px] leading-normal text-white/85">{c.channelBody}</p>
                <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium text-[#1f7a4c] hover:bg-[#edf0e8]">
                  <WhatsAppIcon className="h-5 w-5" />
                  {c.channelButton}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The sermons: quiet, last ─────────────────────────── */}
      <section className="bg-[var(--home-day)] pb-24">
        <div className="mx-auto max-w-[72rem] px-4 sm:px-6">
          <div className="grid items-center gap-6 border-t border-[var(--home-line)] pt-10 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-[1.75rem] leading-tight font-normal">{c.sermonsTitle}</h2>
              <p className="mt-2 max-w-[40rem] leading-relaxed text-zinc-500 dark:text-zinc-400">{c.sermonsBody}</p>
            </div>
            <Link prefetch={false} href={chatHref("sermons")} className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-[15.5px] font-medium hover:border-foreground dark:border-zinc-600">
              {c.sermonsButton}
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter language={lang} />
      <p className="bg-[var(--home-day)] pb-6 text-center text-[11.5px] text-zinc-500 dark:text-zinc-400">{c.photoCredit}</p>
    </div>
  );
}
