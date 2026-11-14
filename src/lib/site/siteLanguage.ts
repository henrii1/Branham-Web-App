/**
 * The reader's site language: what they picked with a language switcher
 * (cookie `site-lang`, a year), otherwise their browser's language when it
 * is French or Spanish, otherwise English. The home page uses it to send a
 * first visit to /fr or /es (middleware), and a new chat for someone who
 * isn't signed in answers in it. Signed-in readers keep their profile
 * language in the chat.
 *
 * No React here: the middleware imports it.
 */

export type SiteLang = "en" | "es" | "fr";

export const SITE_LANG_COOKIE = "site-lang";

export function isSiteLang(value: string | null | undefined): value is SiteLang {
  return value === "en" || value === "es" || value === "fr";
}

/** The reader's first browser language when it is French or Spanish; anything else is English. */
export function pickBrowserLanguage(languages: readonly string[]): SiteLang {
  const base = (languages[0] ?? "").trim().toLowerCase().split(/[-_;]/)[0];
  return isSiteLang(base) ? base : "en";
}

/** Accept-Language → ordered tags, by q value. */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.tag);
}

/** Remember a language picked on the site (client only). */
export function rememberSiteLanguage(lang: SiteLang): void {
  try {
    document.cookie = `${SITE_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies blocked */
  }
}

/** The site language in the browser: the saved pick, else the browser's language (client only). */
export function readSiteLanguage(): SiteLang {
  try {
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SITE_LANG_COOKIE}=`))
      ?.split("=")[1];
    if (isSiteLang(saved)) return saved;
    return pickBrowserLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
  } catch {
    return "en";
  }
}

/** Home page address for a language. */
export function homeHref(lang: string): string {
  return lang === "es" || lang === "fr" ? `/${lang}` : "/";
}
