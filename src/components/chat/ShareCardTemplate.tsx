"use client";

import { forwardRef } from "react";
import type { ShareCardTextShade } from "@/lib/share/cardBackgrounds";

export type ShareCardFormat = "landscape" | "portrait";

export interface ShareCardTemplateProps {
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
  backgroundSrc: string;
  textShade: ShareCardTextShade;
  readMoreLabel: string;
  readMoreUrl: string;
  format: ShareCardFormat;
  // Null while the QR module matrix is still being generated — renders
  // nothing until ready rather than a placeholder, since generation
  // resolves quickly and the modal is already gated on cardReady.
  qrMatrix: boolean[][] | null;
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
    { firstQuestion, latestQuestion, answerExcerptHtml, backgroundSrc, textShade, readMoreLabel, readMoreUrl, format, qrMatrix },
    ref,
  ) {
    const { width: cardWidth, height: cardHeight } = CARD_DIMENSIONS[format];
    const plainAnswerLength = answerExcerptHtml.replace(/<[^>]*>/g, "").length;
    const totalChars = (firstQuestion?.length ?? 0) + latestQuestion.length + plainAnswerLength;
    const { questionSize, answerSize, gap } =
      format === "portrait" ? getPortraitSizing(totalChars) : getLandscapeSizing(totalChars);
    const paddingY = format === "portrait" ? 160 : 48;
    const paddingX = format === "portrait" ? 80 : 88;
    const answerMaxWidth = format === "portrait" ? 840 : 880;
    const titleCasedQuestion = toTitleCase(latestQuestion);
    // Corner brand mark scales up a little for portrait, matching the
    // pattern the rest of the card's type already follows.
    const brandMarkIconSize = format === "portrait" ? 40 : 32;
    const brandMarkTextSize = format === "portrait" ? 20 : 16;
    // Bare domain, not the full URL — a long share URL is impractical to
    // read or type by hand. Parsed rather than hardcoded so it stays
    // correct on preview/staging domains. The QR code (bottom-right)
    // carries the exact deep link instead.
    const shortReadMoreUrl = new URL(readMoreUrl).host;
    const qrSize = format === "portrait" ? 96 : 76;

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
        {/* Plain <img> rather than a CSS background-image — html-to-image
            is less reliable at embedding `background: url(...)` across
            browsers than a real <img> src during rasterization (same fix
            already applied to the corner brand mark's logo below). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundSrc}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: textShade.scrimCss }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${paddingY}px ${paddingX}px`,
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
              textAlign: "center",
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
            {readMoreLabel} → {shortReadMoreUrl}
          </div>
        </div>

        {/* Corner brand mark — icon + name, matching the app's own header
            lockup (BrandLogo.tsx: logo image + Newsreader wordmark), not
            the card's own Fraunces question face. Plain text, no arrow, no
            URL, no link color: this is a logo, not a second link. Not a
            real hyperlink either way — the card is a static rasterized
            PNG, nothing on it is clickable in any viewer. */}
        <div
          style={{
            position: "absolute",
            left: paddingX,
            bottom: paddingY,
            display: "flex",
            alignItems: "center",
            gap: brandMarkIconSize * 0.22,
          }}
        >
          {/* Plain <img> against the public static path (not next/image's
              optimization proxy) — html-to-image rasterizes the live DOM,
              and a stable, directly-fetchable URL avoids any risk of the
              logo being blank in the exported PNG because an optimization
              request hadn't resolved yet. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            width={brandMarkIconSize}
            height={brandMarkIconSize}
            style={{ width: brandMarkIconSize, height: brandMarkIconSize, borderRadius: brandMarkIconSize * 0.22 }}
          />
          <span
            style={{
              fontFamily: "var(--font-newsreader), 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
              letterSpacing: "-0.02em",
              fontSize: brandMarkTextSize,
              fontWeight: 600,
              color: textShade.textColor,
            }}
          >
            Branham Sermons Assistant
          </span>
        </div>

        {/* QR code, bottom-right — mirrors the corner brand mark's inset on
            the opposite corner. Encodes the exact deep link (readMoreUrl),
            not the shortened domain text above: this is what makes the
            Download Image card self-contained even when it travels with no
            accompanying clickable link (WhatsApp Status, Instagram, saved
            and reposted elsewhere). Fixed white/dark contrast regardless of
            the card's text shade — scannability needs guaranteed contrast,
            which deriving from the light/dark theme could compromise on
            some background/shade combinations. */}
        {qrMatrix && (
          <div
            style={{
              position: "absolute",
              right: paddingX,
              bottom: paddingY,
              display: "grid",
              gridTemplateColumns: `repeat(${qrMatrix.length}, 1fr)`,
              gridTemplateRows: `repeat(${qrMatrix.length}, 1fr)`,
              width: qrSize,
              height: qrSize,
              background: "#ffffff",
              padding: qrSize * 0.08,
              boxSizing: "border-box",
            }}
          >
            {qrMatrix.flatMap((row, r) =>
              row.map((dark, c) => (
                <div key={`${r}-${c}`} style={{ background: dark ? "#18181b" : "#ffffff" }} />
              )),
            )}
          </div>
        )}
      </div>
    );
  },
);
