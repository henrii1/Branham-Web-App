import { ImageResponse } from "next/og";
import { fetchSeoPage } from "@/lib/db/seo-queries";
import { buildOgExcerptText } from "@/lib/share/cardExcerpt";
import { renderOgImage } from "@/lib/share/renderOgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FALLBACK = {
  question: "Branham Sermons Assistant",
  excerptText: "Ask questions grounded in the original sermon texts.",
};

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await fetchSeoPage(slug);
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
