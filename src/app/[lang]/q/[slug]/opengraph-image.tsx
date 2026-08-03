import { ImageResponse } from "next/og";
import { fetchSeoPage } from "@/lib/db/seo-queries";
import { buildOgExcerptText } from "@/lib/share/cardExcerpt";
import { renderOgImage } from "@/lib/share/renderOgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const FALLBACK = {
  question: "Branham Sermons Assistant",
  excerptText: "Ask questions grounded in the original sermon texts.",
};

export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) {
    return new ImageResponse(renderOgImage(FALLBACK), size);
  }

  const page = await fetchSeoPage(slug, lang);
  if (!page) {
    return new ImageResponse(renderOgImage(FALLBACK), size);
  }

  return new ImageResponse(
    renderOgImage({
      question: page.question,
      excerptText: buildOgExcerptText(page.answer_markdown),
    }),
    size,
  );
}
