"use client";

import { forwardRef } from "react";
import type { ShareCardTextShade } from "@/lib/share/cardBackgrounds";

export interface ShareCardTemplateProps {
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
  backgroundCss: string;
  textShade: ShareCardTextShade;
  readMoreLabel: string;
  readMoreUrl: string;
}

// WhatsApp-Status-style dynamic sizing: less text fills the card at a
// bigger, more confident size; more text steps down through these tiers
// so a long answer still fits without visually overflowing or looking
// crammed. Tiers are on the COMBINED length of context + question +
// answer, since all three scale together as one centered block.
function getCardSizing(totalChars: number) {
  if (totalChars < 120) return { questionSize: 46, answerSize: 25, gap: 32 };
  if (totalChars < 280) return { questionSize: 38, answerSize: 22, gap: 28 };
  if (totalChars < 480) return { questionSize: 32, answerSize: 19, gap: 24 };
  if (totalChars < 700) return { questionSize: 27, answerSize: 17, gap: 20 };
  return { questionSize: 23, answerSize: 15.5, gap: 16 };
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const ShareCardTemplate = forwardRef<HTMLDivElement, ShareCardTemplateProps>(
  function ShareCardTemplate(
    { firstQuestion, latestQuestion, answerExcerptHtml, backgroundCss, textShade, readMoreLabel, readMoreUrl },
    ref,
  ) {
    const plainAnswerLength = answerExcerptHtml.replace(/<[^>]*>/g, "").length;
    const totalChars = (firstQuestion?.length ?? 0) + latestQuestion.length + plainAnswerLength;
    const { questionSize, answerSize, gap } = getCardSizing(totalChars);
    // `text-align: justify` stretches ugly, oversized gaps into a short
    // answer that only ever renders as a single line — justify only reads
    // well once a paragraph actually wraps. Below this length the answer
    // is virtually guaranteed to stay on one line even at the largest
    // tier's font size, so center it instead.
    const answerWraps = plainAnswerLength > 80;

    return (
      <div
        ref={ref}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
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
            padding: "48px 88px",
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
                {firstQuestion}
              </div>
            )}
            <div
              style={{
                fontFamily: "var(--font-newsreader), Georgia, serif",
                fontSize: questionSize,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {latestQuestion}
            </div>
          </div>

          <div
            style={{
              fontSize: answerSize,
              lineHeight: 1.55,
              textAlign: answerWraps ? "justify" : "center",
              textAlignLast: "center",
              maxWidth: 880,
            }}
            dangerouslySetInnerHTML={{ __html: answerExcerptHtml }}
          />

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
