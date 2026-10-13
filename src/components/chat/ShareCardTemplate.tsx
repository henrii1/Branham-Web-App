"use client";

import { forwardRef } from "react";
import type { ShareCardTextShade } from "@/lib/share/cardBackgrounds";

export type ShareCardFormat = "portrait" | "post" | "tiktok";

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

// Portrait (1080x1920, 9:16) is WhatsApp Status / Stories. Post (1080x1350,
// 4:5, labelled Instagram) is the tallest shape Instagram's feed shows
// uncropped — 9:16 gets cut top and bottom there. TikTok is 9:16 too, laid
// out clear of TikTok's own overlay: its buttons run down the right edge and
// the caption across the bottom. All use the same background photos via
// object-fit: cover.
export const CARD_DIMENSIONS: Record<ShareCardFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
  tiktok: { width: 1080, height: 1920 },
};

// Where things sit on each format. `pad*` bound the centered text block;
// the brand mark (bottom-left) and QR code (bottom-right) sit `footerBottom`
// up from the bottom edge, at `padLeft` / `padRight` in from the sides.
const LAYOUT: Record<
  ShareCardFormat,
  { padTop: number; padBottom: number; padLeft: number; padRight: number; footerBottom: number; answerMaxWidth: number; brandIcon: number; brandText: number; qr: number }
> = {
  portrait: { padTop: 160, padBottom: 160, padLeft: 80, padRight: 80, footerBottom: 160, answerMaxWidth: 840, brandIcon: 40, brandText: 20, qr: 96 },
  post: { padTop: 96, padBottom: 96, padLeft: 80, padRight: 80, footerBottom: 96, answerMaxWidth: 880, brandIcon: 36, brandText: 18, qr: 88 },
  // TikTok's caption covers roughly the bottom 380px and its button column
  // the right ~170px, so the text block and footer stay above and left of them.
  tiktok: { padTop: 200, padBottom: 540, padLeft: 80, padRight: 190, footerBottom: 400, answerMaxWidth: 780, brandIcon: 40, brandText: 20, qr: 96 },
};

// Dynamic sizing: less text fills the card at a bigger, more confident
// size; more text steps down through these tiers so a long answer still
// fits without overflowing. Tiers are on the COMBINED length of context +
// question + answer, since all three scale together as one centered block.

// Portrait is viewed full-screen, close-up, scrolling past in a Story feed
// — it earns the largest type, and the tall canvas wants bigger gaps to
// avoid the centered block reading as a small island in empty space.
function getPortraitSizing(totalChars: number) {
  if (totalChars < 120) return { questionSize: 72, answerSize: 40, gap: 56 };
  if (totalChars < 280) return { questionSize: 60, answerSize: 34, gap: 48 };
  if (totalChars < 480) return { questionSize: 50, answerSize: 29, gap: 40 };
  if (totalChars < 700) return { questionSize: 41, answerSize: 25, gap: 32 };
  return { questionSize: 33, answerSize: 21, gap: 26 };
}

// Post (4:5, Instagram feed): between the two — viewed in a feed at near
// full width, with less height to fill than a story.
function getPostSizing(totalChars: number) {
  if (totalChars < 120) return { questionSize: 62, answerSize: 35, gap: 44 };
  if (totalChars < 280) return { questionSize: 52, answerSize: 30, gap: 38 };
  if (totalChars < 480) return { questionSize: 43, answerSize: 25, gap: 32 };
  if (totalChars < 700) return { questionSize: 36, answerSize: 22, gap: 26 };
  return { questionSize: 30, answerSize: 19, gap: 22 };
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
    const layout = LAYOUT[format];
    // TikTok's text area is about the size of the Instagram card's, so it
    // shares that sizing.
    const { questionSize, answerSize, gap } = format === "portrait" ? getPortraitSizing(totalChars) : getPostSizing(totalChars);
    const answerMaxWidth = layout.answerMaxWidth;
    const titleCasedQuestion = toTitleCase(latestQuestion);
    const brandMarkIconSize = layout.brandIcon;
    const brandMarkTextSize = layout.brandText;
    // Bare domain, not the full URL — a long share URL is impractical to
    // read or type by hand. Parsed rather than hardcoded so it stays
    // correct on preview/staging domains. The QR code (bottom-right)
    // carries the exact deep link instead.
    const shortReadMoreUrl = new URL(readMoreUrl).host;
    const qrSize = layout.qr;

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
            padding: `${layout.padTop}px ${layout.padRight}px ${layout.padBottom}px ${layout.padLeft}px`,
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
            left: layout.padLeft,
            bottom: layout.footerBottom,
            display: "flex",
            alignItems: "center",
            gap: brandMarkIconSize * 0.22,
          }}
        >
          {/* Plain <img> against the public static path (not next/image's
              optimization proxy) — html-to-image rasterizes the live DOM,
              and a stable, directly-fetchable URL avoids any risk of the
              logo being blank in the exported PNG because an optimization
              request hadn't resolved yet. logo-card.png is a 128px copy:
              the 1.4 MB original got embedded whole into every snapshot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-card.png"
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
              right: layout.padRight,
              bottom: layout.footerBottom,
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
