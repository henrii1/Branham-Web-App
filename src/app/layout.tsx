import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Geist, Geist_Mono, Newsreader } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthGate";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { createClient } from "@/lib/supabase/server";
import {
  THEME_COOKIE_NAME,
  normalizeThemePreference,
} from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

// Share-card question display face only — Fraunces' optical-size axis
// gives it real character at large display sizes (ball terminals, ink
// traps) that Newsreader's calmer literary tone doesn't, which is what a
// social pull-quote card wants. Not used anywhere else in the app.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Keyword list order matters — most specific (already-ranking) phrases first
// so the existing rankings on "Branham Sermons Assistant" / "Branham Sermons AI"
// are reinforced before secondary terms get any signal. Google ignores the
// meta tag itself, but Bing / Yandex / DuckDuckGo / Kagi still use it.
const SITE_KEYWORDS = [
  "Branham Sermons Assistant",
  "Branham Sermons AI",
  "Branham Sermons search",
  "Branham Sermons",
  "Branham messages",
  "William Branham Messages",
  "William Branham Doctrines",
  "William Branham Beliefs",
  "Branham",
];

export const metadata: Metadata = {
  metadataBase: new URL("https://branhamsermons.ai"),
  title: {
    default: "Branham Sermons Assistant",
    template: "%s | Branham Sermons Assistant",
  },
  description:
    "Ask questions about the sermons of William Marrion Branham. Answers grounded in the original sermon texts.",
  keywords: SITE_KEYWORDS,
  robots: {
    index: false,
    follow: false,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://branhamsermons.ai/#website",
  name: "Branham Sermons Assistant",
  alternateName: [
    "Branham Sermons AI",
    "Branham Sermons search",
    "Branham Sermons",
    "Branham Messages",
  ],
  url: "https://branhamsermons.ai",
  // Schema.org `keywords` is recognised by structured-data parsers and
  // helps with entity-cluster recall for the secondary terms.
  keywords: SITE_KEYWORDS.join(", "),
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://branhamsermons.ai/#organization",
  name: "Branham Sermons Assistant",
  alternateName: [
    "Branham Sermons AI",
    "Branham Sermons search",
  ],
  url: "https://branhamsermons.ai",
  logo: {
    "@type": "ImageObject",
    url: "https://branhamsermons.ai/logo.png",
    width: 1024,
    height: 1024,
  },
  image: "https://branhamsermons.ai/logo.png",
  // Topics this organisation is authoritative on. Helps Google's
  // knowledge-graph place us in the right entity cluster.
  knowsAbout: [
    "William Marrion Branham",
    "Branham Sermons",
    "Branham Messages",
    "William Branham Doctrines",
    "William Branham Beliefs",
    "Serpent Seed doctrine",
    "Seven Church Ages",
    "Godhead",
    "Baptism in Jesus' Name",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@branhamsermons.ai",
    contactType: "customer support",
  },
};

const siteNavigationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SiteNavigationElement",
  name: ["Chat", "Popular Questions"],
  url: [
    "https://branhamsermons.ai/chat",
    "https://branhamsermons.ai/faq",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  let initialTheme = normalizeThemePreference(cookieTheme);

  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("theme_preference")
      .eq("user_id", user.id)
      .single();

    if (!error) {
      initialTheme = normalizeThemePreference(
        profile?.theme_preference,
        initialTheme,
      );
    }
  }

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "dark" : undefined}
      data-theme={initialTheme}
    >
      <head>
        {/* llms.txt discovery hint (https://llmstxt.org). Set here as a raw
            <link> so it's emitted on every route — Next.js's Metadata.alternates
            is replaced per-page, so a layout-level alternates field gets
            wiped on any page that sets its own canonical. */}
        <link rel="alternate" type="text/plain" href="/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${fraunces.variable} antialiased`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider initialUser={user}>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
