// Shared JSX tree for every dynamic Open Graph preview image (see the
// 4 opengraph-image.tsx route files under /share/[hash] and /q/[slug]).
// Rendered by next/og's `ImageResponse` (Satori), which supports only a
// constrained subset of CSS — flexbox + absolute positioning + explicit
// pixel values, no Tailwind classes, no arbitrary HTML via
// dangerouslySetInnerHTML — the same inline-style-only discipline
// ShareCardTemplate.tsx already follows for its own (different) renderer.
// This is deliberately a simpler visual than the downloadable card, not a
// pixel-accurate replica: no dynamic font-size tiers, no QR code (the
// recipient already has a tappable link in this context — see the design
// spec's Non-Goals), fixed-length truncation instead of the full card's
// citation-aware excerpt budget.

const MAX_QUESTION_CHARS = 110;
const MAX_EXCERPT_DISPLAY_CHARS = 220;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

export interface RenderOgImageProps {
  question: string;
  excerptText: string;
}

export function renderOgImage({ question, excerptText }: RenderOgImageProps) {
  const displayQuestion = truncate(question, MAX_QUESTION_CHARS);
  const displayExcerpt = truncate(excerptText, MAX_EXCERPT_DISPLAY_CHARS);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://branhamsermons.ai/share-backgrounds/light.png"
        alt=""
        width={1200}
        height={630}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(255,255,255,0.8)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "64px 96px",
          gap: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.15,
            color: "#18181b",
          }}
        >
          {displayQuestion}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            lineHeight: 1.5,
            color: "#3f3f46",
          }}
        >
          {displayExcerpt}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 48,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://branhamsermons.ai/logo.png"
          alt=""
          width={40}
          height={40}
          style={{ width: 40, height: 40, borderRadius: 9 }}
        />
        <div style={{ display: "flex", fontSize: 20, fontWeight: 600, color: "#18181b" }}>
          Branham Sermons Assistant
        </div>
      </div>
    </div>
  );
}
