// Link-preview image for the Christianity Seen in Nature series page
// (opengraph-image.tsx under /faq/nature and /[lang]/faq/nature), rendered by
// next/og (Satori): inline styles, flexbox and absolute positioning only.
// Gradient only, one wrapper div for the background (Satori drops fragment
// children), so the PNG stays well under WhatsApp's ~300 KB preview limit.

import { ALTAR_OG_BRAND, ALTAR_IMAGE_DOMAIN } from "@/lib/altar/renderAltarOgImage";

const SITE = "https://branhamsermons.ai";
export const NATURE_SERIES_OG_SIZE = { width: 1200, height: 630 };
const MAX_PARTS_SHOWN = 4;

export interface NatureSeriesOgContent {
  title: string;
  /** e.g. "A series in 3 parts, read in order". */
  subtitle: string;
  /** Each part's label and name, in order. */
  parts: { label: string; name: string }[];
}

export function renderNatureSeriesOgImage({ title, subtitle, parts }: NatureSeriesOgContent) {
  const shown = parts.slice(0, MAX_PARTS_SHOWN);
  const accent = "#a9d1b2";
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Newsreader, serif", color: "#f4f8f2", backgroundColor: "#1d3024" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(155deg, #122017 0%, #1d3024 55%, #2f4c37 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "radial-gradient(circle at 88% 105%, rgba(169,209,178,0.35) 0%, rgba(169,209,178,0.1) 35%, rgba(0,0,0,0) 65%)" }} />
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "60px 80px 48px" }}>
        <div style={{ display: "flex", fontSize: 66, lineHeight: 1.08, fontWeight: 500, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ display: "flex", fontSize: 28, color: accent, marginTop: 14 }}>{subtitle}</div>
        {/* The path: a line with a dot per part. */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, marginLeft: 8, borderLeft: "2px solid rgba(169,209,178,0.45)", paddingLeft: 26, gap: 14 }}>
          {shown.map((p) => (
            <div key={p.label} style={{ display: "flex", alignItems: "center", fontSize: 30, position: "relative" }}>
              <div style={{ position: "absolute", left: -34, width: 14, height: 14, borderRadius: 7, backgroundColor: accent }} />
              <span style={{ color: accent, marginRight: 16 }}>{p.label}</span>
              <span>{p.name}</span>
            </div>
          ))}
          {parts.length > shown.length && <div style={{ display: "flex", fontSize: 26, color: "rgba(244,248,242,0.6)" }}>…</div>}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SITE}/logo-card.png`} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 9 }} />
            <div style={{ display: "flex", fontSize: 24 }}>{ALTAR_OG_BRAND}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: accent }}>{ALTAR_IMAGE_DOMAIN}</div>
        </div>
      </div>
    </div>
  );
}
