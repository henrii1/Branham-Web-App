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
    default: "Branham Sermons AI",
    template: "%s | Branham Sermons AI",
  },
  description:
    "Ask questions about the sermons of William Marrion Branham. AI-powered search and answers grounded in the original sermon texts.",
  robots: {
    index: false,
    follow: false,
  },
};

const siteLevelJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://branhamsermons.ai/#website",
    name: "Branham Sermons AI",
    url: "https://branhamsermons.ai",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://branhamsermons.ai/#organization",
    name: "Branham Sermons AI",
    url: "https://branhamsermons.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://branhamsermons.ai/og-image.png",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: "info@branhamsermons.ai",
      contactType: "customer support",
    },
  },
];

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLevelJsonLd) }}
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
