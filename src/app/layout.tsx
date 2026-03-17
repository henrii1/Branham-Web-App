import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://branhamsermons.ai"),
  title: {
    default: "Branham Sermons Assistant",
    template: "%s | Branham Sermons Assistant",
  },
  description:
    "Ask questions about the sermons of William Marrion Branham. Answers grounded in the original sermon texts.",
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
  alternateName: "Branham Sermons AI",
  url: "https://branhamsermons.ai",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://branhamsermons.ai/#organization",
  name: "Branham Sermons Assistant",
  alternateName: "Branham Sermons AI",
  url: "https://branhamsermons.ai",
  logo: {
    "@type": "ImageObject",
    url: "https://branhamsermons.ai/logo.png",
    width: 1024,
    height: 1024,
  },
  image: "https://branhamsermons.ai/logo.png",
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
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider initialUser={user}>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
