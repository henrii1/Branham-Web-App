import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/site/social";
import { altarHref } from "@/lib/altar/strings";
import { aboutHref } from "@/lib/about/content";
import { FacebookIcon, InstagramIcon, MailIcon, TikTokIcon, WhatsAppIcon, XIcon } from "./SocialIcons";

type FooterLang = "en" | "es" | "fr";

const COPY: Record<FooterLang, { about: string; faq: string; altar: string; contact: string; follow: string; site: string }> = {
  en: { about: "About", faq: "Questions of Faith", altar: "Family Altar", contact: "Contact us", follow: "Follow us", site: "Site" },
  es: { about: "Acerca de", faq: "Preguntas de fe", altar: "Altar Familiar", contact: "Contáctenos", follow: "Síganos", site: "Sitio" },
  fr: { about: "À propos", faq: "Questions de foi", altar: "Autel familial", contact: "Nous contacter", follow: "Suivez-nous", site: "Site" },
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
