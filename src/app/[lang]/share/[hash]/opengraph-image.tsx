import { ImageResponse } from "next/og";
import { fetchShareByHash, fetchSharedMessages } from "@/lib/db/share-queries";
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

export default async function Image({ params }: { params: Promise<{ lang: string; hash: string }> }) {
  const { lang, hash } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) {
    return new ImageResponse(renderOgImage(FALLBACK), size);
  }

  const share = await fetchShareByHash(hash);
  if (!share || share.language !== lang) {
    return new ImageResponse(renderOgImage(FALLBACK), size);
  }

  const messages = await fetchSharedMessages(hash);
  const latestAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  return new ImageResponse(
    renderOgImage({
      question: share.title_snapshot ?? "Shared conversation",
      excerptText: latestAnswer ? buildOgExcerptText(latestAnswer) : FALLBACK.excerptText,
    }),
    size,
  );
}
