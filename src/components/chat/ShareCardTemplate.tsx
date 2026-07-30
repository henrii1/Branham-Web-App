"use client";

import { forwardRef } from "react";
import type { ShareCardTextShade } from "@/lib/share/cardBackgrounds";

export type ShareCardFormat = "landscape" | "portrait";

export interface ShareCardTemplateProps {
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
  backgroundCss: string;
  textShade: ShareCardTextShade;
  readMoreLabel: string;
  readMoreUrl: string;
  format: ShareCardFormat;
}

// Landscape (1200x630) matches the Open Graph / Facebook link-preview
// convention. Portrait (1080x1920, 9:16) matches WhatsApp/Instagram Story
// dimensions. Both share the same three background tile patterns — they're
// seamless repeating tiles (not photos with an off-center subject), so
// `background-size: cover` recrops losslessly to either aspect ratio with
// no separate portrait-specific image assets needed.
export const CARD_DIMENSIONS: Record<ShareCardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1920 },
};

// WhatsApp-Status-style dynamic sizing: less text fills the card at a
// bigger, more confident size; more text steps down through these tiers
// so a long answer still fits without visually overflowing or looking
// crammed. Tiers are on the COMBINED length of context + question +
// answer, since all three scale together as one centered block.
function getLandscapeSizing(totalChars: number) {
  if (totalChars < 120) return { questionSize: 46, answerSize: 25, gap: 32 };
  if (totalChars < 280) return { questionSize: 38, answerSize: 22, gap: 28 };
  if (totalChars < 480) return { questionSize: 32, answerSize: 19, gap: 24 };
  if (totalChars < 700) return { questionSize: 27, answerSize: 17, gap: 20 };
  return { questionSize: 23, answerSize: 15.5, gap: 16 };
}

// Portrait is viewed full-screen, close-up, scrolling past in a Story feed
// — it earns noticeably larger type than the landscape link-preview card,
// and the extra vertical canvas (1920 vs 630) wants bigger gaps to avoid
// the centered block reading as a small island in empty space.
function getPortraitSizing(totalChars: number) {
  if (totalChars < 120) return { questionSize: 72, answerSize: 40, gap: 56 };
  if (totalChars < 280) return { questionSize: 60, answerSize: 34, gap: 48 };
  if (totalChars < 480) return { questionSize: 50, answerSize: 29, gap: 40 };
  if (totalChars < 700) return { questionSize: 41, answerSize: 25, gap: 32 };
  return { questionSize: 33, answerSize: 21, gap: 26 };
}

// Capitalizes the first letter of every word, leaving the rest of each
// word's casing untouched — fixes an all-lowercase question without
// clobbering proper nouns/acronyms that are already correctly cased.
function toTitleCase(text: string): string {
  return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function ContinuationDots({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      ))}
    </div>
  );
}

export const ShareCardTemplate = forwardRef<HTMLDivElement, ShareCardTemplateProps>(
  function ShareCardTemplate(
    { firstQuestion, latestQuestion, answerExcerptHtml, backgroundCss, textShade, readMoreLabel, readMoreUrl, format },
    ref,
  ) {
    const { width: cardWidth, height: cardHeight } = CARD_DIMENSIONS[format];
    const plainAnswerLength = answerExcerptHtml.replace(/<[^>]*>/g, "").length;
    const totalChars = (firstQuestion?.length ?? 0) + latestQuestion.length + plainAnswerLength;
    const { questionSize, answerSize, gap } =
      format === "portrait" ? getPortraitSizing(totalChars) : getLandscapeSizing(totalChars);
    // `text-align: justify` stretches ugly, oversized gaps into a short
    // answer that only ever renders as a single line — justify only reads
    // well once a paragraph actually wraps. Below this length the answer
    // is virtually guaranteed to stay on one line even at the largest
    // tier's font size, so center it instead.
    const answerWraps = plainAnswerLength > 80;
    const padding = format === "portrait" ? "160px 80px" : "48px 88px";
    const answerMaxWidth = format === "portrait" ? 840 : 880;
    const titleCasedQuestion = toTitleCase(latestQuestion);

    return (
      <div
        ref={ref}
        style={{
          width: cardWidth,
          height: cardHeight,
          position: "relative",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          color: textShade.textColor,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: backgroundCss }} />
        <div style={{ position: "absolute", inset: 0, background: textShade.scrimCss }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap,
            textAlign: "center",
          }}
        >
          <div>
            {firstQuestion && (
              <div
                style={{
                  fontSize: questionSize * 0.42,
                  lineHeight: 1.4,
                  color: textShade.mutedColor,
                  marginBottom: gap * 0.35,
                }}
              >
                {toTitleCase(firstQuestion)}
              </div>
            )}
            <div
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontWeight: 600,
                fontSize: questionSize,
                lineHeight: 1.2,
              }}
            >
              {titleCasedQuestion}
            </div>
          </div>

          <div
            className="share-card-excerpt"
            style={{
              fontSize: answerSize,
              lineHeight: 1.55,
              textAlign: answerWraps ? "justify" : "center",
              textAlignLast: "center",
              maxWidth: answerMaxWidth,
            }}
            dangerouslySetInnerHTML={{ __html: answerExcerptHtml }}
          />

          <ContinuationDots color={textShade.mutedColor} />

          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 15,
              fontWeight: 600,
              color: textShade.linkColor,
            }}
          >
            {readMoreLabel} → {readMoreUrl}
          </div>
        </div>
      </div>
    );
  },
);
