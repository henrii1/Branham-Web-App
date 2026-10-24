import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/site/social";
import { altarHref } from "@/lib/altar/strings";
import { aboutHref } from "@/lib/about/content";

type FooterLang = "en" | "es" | "fr";

const COPY: Record<FooterLang, { about: string; faq: string; altar: string; contact: string; follow: string; site: string }> = {
  en: { about: "About", faq: "FAQ", altar: "Family Altar", contact: "Contact us", follow: "Follow us", site: "Site" },
  es: { about: "Acerca de", faq: "Preguntas frecuentes", altar: "Altar Familiar", contact: "Contáctenos", follow: "Síganos", site: "Sitio" },
  fr: { about: "À propos", faq: "Questions fréquentes", altar: "Autel familial", contact: "Nous contacter", follow: "Suivez-nous", site: "Site" },
};

const prefix = (lang: FooterLang) => (lang === "en" ? "" : `/${lang}`);

/**
 * Site footer for document-style pages (About, Family Altar, FAQ list) —
 * not the chat screen. Page links on the left, contact + social icons on
 * the right.
 */
export function SiteFooter({ language }: { language: string }) {
  const lang: FooterLang = language === "es" || language === "fr" ? language : "en";
  const c = COPY[lang];
  const icons: { label: string; href: string; icon: ReactNode; external: boolean }[] = [
    { label: c.contact, href: `mailto:${CONTACT_EMAIL}`, icon: <MailIcon />, external: false },
    { label: "WhatsApp", href: SOCIAL_LINKS.whatsapp, icon: <WhatsAppIcon />, external: true },
    { label: "Instagram", href: SOCIAL_LINKS.instagram, icon: <InstagramIcon />, external: true },
    { label: "Facebook", href: SOCIAL_LINKS.facebook, icon: <FacebookIcon />, external: true },
    { label: "TikTok", href: SOCIAL_LINKS.tiktok, icon: <TikTokIcon />, external: true },
    { label: "X", href: SOCIAL_LINKS.x, icon: <XIcon />, external: true },
  ];

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      {/* Phones: icons first as one even row (the reason people scroll here),
          page links centred, a small sign-off last; the brand name is left
          to the page header. sm+: brand and links left, icons right. */}
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 pt-7 pb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-7 xl:max-w-[56rem]">
        <nav aria-label={c.follow} className="order-1 grid w-full max-w-xs grid-cols-6 justify-items-center gap-1 sm:order-2 sm:flex sm:w-auto sm:max-w-none sm:gap-1.5">
          {icons.map((i) => (
            <a
              key={i.label}
              href={i.href}
              aria-label={i.label}
              title={i.label}
              {...(i.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="grid h-11 w-11 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground sm:h-9 sm:w-9 sm:rounded-[10px] sm:border sm:border-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:dark:border-zinc-800"
            >
              {i.icon}
            </a>
          ))}
        </nav>

        <div className="order-2 flex flex-col items-center gap-3 sm:order-1 sm:items-start sm:gap-2.5">
          {/* Wrapper does the hiding: BrandLogo sets its own inline-flex. */}
          <div className="hidden sm:block">
            <BrandLogo href="/" size={28} />
          </div>
          <nav aria-label={c.site} className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13.5px] text-zinc-600 sm:justify-start sm:gap-x-4 sm:text-[13px] sm:text-zinc-500 dark:text-zinc-400">
            <Link prefetch={false} href={aboutHref(lang)} className="hover:text-foreground">{c.about}</Link>
            <Link prefetch={false} href={`${prefix(lang)}/faq`} className="hover:text-foreground">{c.faq}</Link>
            <Link prefetch={false} href={altarHref(lang)} className="hover:text-foreground">{c.altar}</Link>
          </nav>
          <small className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-card.png" alt="" width={16} height={16} className="h-4 w-4 rounded sm:hidden" />
            © BranhamSermons.ai
          </small>
        </div>
      </div>
    </footer>
  );
}

const svg = "h-[18px] w-[18px]";

function MailIcon() {
  return (
    <svg className={svg} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg className={svg} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.3 6.3 0 1 0 5.3 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}
