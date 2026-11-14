"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LangSwitcher } from "@/components/seo/LangSwitcher";
import { WhatsAppIcon } from "@/components/site/SocialIcons";
import { createClient } from "@/lib/supabase/client";
import { aboutHref } from "@/lib/about/content";
import { altarHref } from "@/lib/altar/strings";
import { seriesPagePath } from "@/lib/faq/series";
import { SITE_NAV, bibleQuestionsHref, chatHref } from "@/lib/site/home";
import { homeHref, type SiteLang } from "@/lib/site/siteLanguage";
import { CONTACT_EMAIL, WHATSAPP_CHANNEL_URL } from "@/lib/site/social";

interface SiteHeaderProps {
  lang: SiteLang;
  langHrefs: Record<SiteLang, string>;
  /** "night": light text on the dark green (home hero, overlays it). "page": the theme's surface. */
  tone?: "night" | "page";
  /** Overlay the next element (the home hero) instead of taking space. */
  overlay?: boolean;
  natureCount?: number;
  bibleCount?: number;
}

/**
 * The site's one header: brand, the main pages in the site's order, the
 * language switcher, an Ask menu (Ask the Bible / Search the sermons — the
 * two ways into the chat, so nobody has to be asked which), and on phones a
 * full-screen menu that mirrors the links page.
 */
export function SiteHeader({ lang, langHrefs, tone = "page", overlay = false, natureCount, bibleCount }: SiteHeaderProps) {
  const c = SITE_NAV[lang];
  const [menuOpen, setMenuOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const askRef = useRef<HTMLDivElement>(null);
  const prefix = lang === "en" ? "" : `/${lang}`;
  const night = tone === "night";

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSignedIn(!!data.session))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!askOpen) return;
    const close = (e: MouseEvent) => {
      if (askRef.current && !askRef.current.contains(e.target as Node)) setAskOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [askOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const nav = [
    { label: c.nature, href: seriesPagePath(lang) },
    { label: c.bibleQuestions, href: bibleQuestionsHref(lang) },
    { label: c.altar, href: altarHref(lang) },
    { label: c.videos, href: `${homeHref(lang)}#videos` },
    { label: c.about, href: aboutHref(lang) },
  ];

  const text = night ? "text-[#edf0e8]" : "text-foreground";
  const navLink = night
    ? "text-[#edf0e8]/85 hover:text-white"
    : "text-zinc-600 hover:text-foreground dark:text-zinc-300";

  return (
    <>
      <header
        className={`${overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 shrink-0"} ${
          night ? (overlay ? "" : "bg-[var(--home-night)]") : "border-b border-zinc-200 bg-[var(--surface-base)] dark:border-zinc-800"
        } ${text}`}
      >
        <div className="mx-auto flex h-16 max-w-[72rem] items-center gap-6 px-4 sm:px-6">
          <BrandLogo href={homeHref(lang)} size={30} priority className={`shrink-0 ${night ? "[&_img]:bg-white [&_img]:p-0.5" : ""}`} nameClassName={night ? "!text-[#edf0e8]" : ""} />
          <nav aria-label={c.menu} className="ml-auto hidden items-center gap-5 text-[14px] whitespace-nowrap xl:flex">
            {nav.map((n) => (
              <Link key={n.href} prefetch={false} href={n.href} className={`transition-colors ${navLink}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className={`ml-auto flex items-center gap-2 xl:ml-0 ${night ? "[&_button]:!border-white/30 [&_button]:!text-[#edf0e8] [&_button:hover]:!bg-white/10" : ""}`}>
            <LangSwitcher current={lang} hrefs={langHrefs} />
          </div>
          <div ref={askRef} className="relative hidden whitespace-nowrap lg:block">
            <button
              type="button"
              aria-expanded={askOpen}
              aria-haspopup="menu"
              onClick={() => setAskOpen((o) => !o)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors ${
                night ? "bg-[var(--home-leaf)] text-[var(--home-night)] hover:bg-[#a6d2b2]" : "bg-[var(--home-meadow)] text-white hover:bg-[#265a39]"
              }`}
            >
              {c.ask}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {askOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                {[
                  { label: c.askBible, note: c.askBibleNote, href: chatHref("bible") },
                  { label: c.askSermons, note: c.askSermonsNote, href: chatHref("sermons") },
                ].map((a) => (
                  <Link key={a.href} role="menuitem" prefetch={false} href={a.href} className="flex flex-col rounded-xl px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span className="text-[14.5px] font-medium">{a.label}</span>
                    <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{a.note}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={c.menu}
            aria-expanded={menuOpen}
            className="-mr-2 grid h-10 w-10 place-items-center rounded-lg xl:hidden"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div role="dialog" aria-modal="true" aria-label={c.menu} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--home-night)] px-4 pb-8 text-[#edf0e8]">
          <div className="flex h-16 shrink-0 items-center">
            <BrandLogo href={homeHref(lang)} size={30} className="[&_img]:bg-white [&_img]:p-0.5" nameClassName="!text-[#edf0e8]" />
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={c.close} className="-mr-2 ml-auto grid h-10 w-10 place-items-center rounded-lg">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <MenuGroup title={c.exploreFaith}>
            <MenuRow big href={seriesPagePath(lang)} title={c.nature} note={natureCount ? c.natureNote(natureCount) : undefined} onPick={() => setMenuOpen(false)} />
            <MenuRow big href={`${homeHref(lang)}#videos`} title={c.videos} note={c.videosNote} onPick={() => setMenuOpen(false)} />
          </MenuGroup>
          <MenuGroup title={c.growInWord}>
            <MenuRow big href={bibleQuestionsHref(lang)} title={c.bibleQuestions} note={bibleCount ? c.bibleQuestionsNote(bibleCount) : undefined} onPick={() => setMenuOpen(false)} />
            <MenuRow big href={altarHref(lang)} title={c.altar} note={c.altarNote} onPick={() => setMenuOpen(false)} />
            <MenuRow href={chatHref("bible")} title={c.askBible} note={c.askBibleNote} onPick={() => setMenuOpen(false)} />
          </MenuGroup>
          <MenuGroup title={c.theSermons}>
            <MenuRow href={chatHref("sermons")} title={c.askSermons} note={c.askSermonsNote} onPick={() => setMenuOpen(false)} />
          </MenuGroup>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 flex items-center gap-3 rounded-2xl bg-[#1f7a4c] px-4 py-3.5 text-white"
          >
            <WhatsAppIcon className="h-6 w-6 shrink-0" />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{c.channelButton}</span>
              <span className="text-[13px] text-white/85">{c.channelNote}</span>
            </span>
          </a>
          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[#edf0e8]/75">
            <Link prefetch={false} href={aboutHref(lang)} onClick={() => setMenuOpen(false)}>{c.about}</Link>
            <Link prefetch={false} href={signedIn ? "/chat" : `/login?next=${encodeURIComponent(prefix || "/")}`} onClick={() => setMenuOpen(false)}>
              {signedIn ? c.yourChats : c.signIn}
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{c.contact}</a>
          </nav>
        </div>
      )}
    </>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-medium text-[var(--home-leaf)]">{title}</h2>
      <ul className="mt-1">{children}</ul>
    </section>
  );
}

function MenuRow({ href, title, note, big, onPick }: { href: string; title: string; note?: string; big?: boolean; onPick: () => void }) {
  return (
    <li className="border-b border-white/10">
      <Link prefetch={false} href={href} onClick={onPick} className="flex flex-col py-3">
        <span className={big ? "font-display text-[1.35rem] leading-tight" : "text-[16px] font-medium"}>{title}</span>
        {note && <span className="mt-0.5 text-[13.5px] text-[#edf0e8]/60">{note}</span>}
      </Link>
    </li>
  );
}
