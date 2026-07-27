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

export const ShareCardTemplate = forwardRef<HTMLDivElement, ShareCardTemplateProps>(
  function ShareCardTemplate(
    { firstQuestion, latestQuestion, answerExcerptHtml, backgroundCss, textShade, readMoreLabel, readMoreUrl },
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          position: "relative",
          fontFamily: "sans-serif",
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
            padding: "56px 64px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {firstQuestion && (
              <div style={{ fontSize: 20, color: textShade.mutedColor, marginBottom: 12 }}>
                {firstQuestion}
              </div>
            )}
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25 }}>
              {latestQuestion}
            </div>
          </div>
          <div
            style={{ fontSize: 18, lineHeight: 1.5, maxHeight: 260, overflow: "hidden" }}
            dangerouslySetInnerHTML={{ __html: answerExcerptHtml }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: textShade.linkColor }}>
            {readMoreLabel} → {readMoreUrl}
          </div>
        </div>
      </div>
    );
  },
);
