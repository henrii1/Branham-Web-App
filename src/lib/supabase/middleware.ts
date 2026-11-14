import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { INTERNAL_AUTH_HEADER } from "@/lib/security/requestHeaders";
import { isSiteLang, parseAcceptLanguage, pickBrowserLanguage, SITE_LANG_COOKIE } from "@/lib/site/siteLanguage";

type CookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

function sanitizeRedirectPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/chat";
  return path;
}

/**
 * Canonical host redirect: www.branhamsermons.ai → branhamsermons.ai.
 * Both hosts otherwise return 200, which splits ranking signals and reads
 * as duplicate content. A 308 (permanent, method-preserving) consolidates
 * everything onto the apex domain. Localhost and the apex itself are
 * untouched.
 */
function buildApexRedirect(request: NextRequest): NextResponse | null {
  const host = (
    request.headers.get("host") ??
    request.nextUrl.host ??
    ""
  ).toLowerCase();

  if (!host.startsWith("www.")) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = host.slice(4); // strip "www."
  return NextResponse.redirect(url, 308);
}

const CRAWLER_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|embed/i;

/**
 * The English home page (/) sends a reader to /fr or /es when that is their
 * language: the one they picked with a language switcher (cookie), else
 * their browser's. Crawlers and link-preview fetchers always get the page
 * they asked for, so each language's home page is indexed on its own URL.
 * 307: the answer depends on the reader, never cache it as permanent.
 */
function buildHomeLanguageRedirect(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/" || request.method !== "GET") return null;
  if (CRAWLER_RE.test(request.headers.get("user-agent") ?? "")) return null;
  const saved = request.cookies.get(SITE_LANG_COOKIE)?.value;
  const lang = isSiteLang(saved)
    ? saved
    : pickBrowserLanguage(parseAcceptLanguage(request.headers.get("accept-language")));
  if (lang === "en") return null;
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}`;
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Vary", "Accept-Language, Cookie");
  return res;
}

function shouldForceHttps(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }
  // A local production build is plain http (npm run preview:local).
  if (/^(localhost|127\.0\.0\.1)$/i.test(request.nextUrl.hostname)) {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.toLowerCase() === "http";
  }

  return request.nextUrl.protocol === "http:";
}

export async function updateSession(request: NextRequest) {
  const apexRedirect = buildApexRedirect(request);
  if (apexRedirect) return apexRedirect;

  if (shouldForceHttps(request)) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  const homeRedirect = buildHomeLanguageRedirect(request);
  if (homeRedirect) return homeRedirect;

  const requestHeaders = new Headers(request.headers);
  const responseCookies = new Map<
    string,
    { name: string; value: string; options?: CookieOptions }
  >();

  const buildResponse = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  };

  let supabaseResponse = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) => {
            responseCookies.set(name, { name, value, options });
          });
          supabaseResponse = buildResponse();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  requestHeaders.set(INTERNAL_AUTH_HEADER, user ? "1" : "0");
  supabaseResponse = buildResponse();

  const { pathname } = request.nextUrl;

  // Allow API routes and auth callback through without redirects
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  // --- Unauthenticated user ---
  if (!user) {
    const isProtected =
      pathname.startsWith("/chat/") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/admin");

    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // --- Authenticated user without onboarding ---
  const onboardingComplete = user.user_metadata?.onboarding_completed === true;

  if (!onboardingComplete) {
    if (!pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding/language";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // --- Authenticated user with onboarding complete ---
  if (pathname === "/login" || pathname === "/signup") {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    url.pathname = sanitizeRedirectPath(next);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/onboarding")) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
