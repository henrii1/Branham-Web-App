// Images for one Family Altar day, rendered by next/og (Satori): inline
// styles, flexbox and absolute positioning only.
//   og    1200×630   link preview (opengraph-image.tsx in the day routes)
//   post  1080×1350  4:5 image post (WhatsApp channel, Instagram/Facebook feed)
//   story 1080×1920  9:16 (WhatsApp Status, Instagram/Facebook Stories)
// The verse is the hero, set in Newsreader (the site's display face) on a
// painted gradient whose colours change every day (DAY_PALETTES). No photo:
// WhatsApp drops link-preview images over ~300 KB, and a photo PNG is ~900 KB.

const SITE = "https://branhamsermons.ai";

export type AltarImageFormat = "og" | "post" | "story";

export const ALTAR_IMAGE_SIZES: Record<AltarImageFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};
export const ALTAR_OG_SIZE = ALTAR_IMAGE_SIZES.og;
export const ALTAR_OG_BRAND = "Branham Sermons Assistant";
export const ALTAR_IMAGE_DOMAIN = "branhamsermons.ai";

export interface AltarOgContent {
  /** "Family Altar" in the page's language. */
  label: string;
  /** Long date in the page's language, e.g. "Monday, October 12". */
  dateLabel: string;
  verse: string | null;
  reference: string | null;
  title: string | null;
}

interface Palette {
  /** Background gradient, dark to lighter. */
  stops: [string, string, string];
  /** Glow colour (r,g,b) rising from the lower right. */
  glow: string;
  /** Label and reference colour. */
  accent: string;
}

// One palette per day of the week; consecutive days always differ.
const DAY_PALETTES: Palette[] = [
  { stops: ["#1b1410", "#2a1b12", "#4a2a14"], glow: "246,177,92", accent: "#f6c87a" }, // dawn
  { stops: ["#0c191e", "#123039", "#1b4a52"], glow: "110,205,192", accent: "#9fe2d6" }, // sea
  { stops: ["#14180f", "#252f19", "#3d4921"], glow: "205,214,120", accent: "#dbe39c" }, // olive
  { stops: ["#1c0f14", "#331521", "#52203a"], glow: "240,140,172", accent: "#f4b6c9" }, // wine
  { stops: ["#0f1022", "#1a1c3d", "#2c2f63"], glow: "150,160,250", accent: "#c4c9ff" }, // night
  { stops: ["#1f1312", "#3a201c", "#5e3328"], glow: "245,160,120", accent: "#f8c4a6" }, // clay
  { stops: ["#0b1611", "#132f21", "#1e4a33"], glow: "120,212,152", accent: "#aae7bf" }, // forest
];

function paletteFor(day: string): Palette {
  // Days since a fixed Monday, so each weekday keeps its colour.
  const n = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse("2026-01-05T00:00:00Z")) / 86_400_000);
  return DAY_PALETTES[((n % 7) + 7) % 7];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.8 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}

// Shorter verses fill the image at a larger size.
const VERSE_TIERS: Record<AltarImageFormat, [number, number][]> = {
  og: [[110, 58], [180, 50], [260, 43], [Infinity, 37]],
  post: [[110, 76], [180, 66], [260, 57], [Infinity, 49]],
  story: [[110, 88], [180, 77], [260, 67], [Infinity, 58]],
};
const MAX_VERSE_CHARS: Record<AltarImageFormat, number> = { og: 380, post: 480, story: 560 };

/**
 * Newsreader from Google Fonts, subset to the characters drawn. Satori needs
 * TTF/OTF, which the css2 API serves to a client that doesn't ask for woff2.
 * Returns null on any failure — the image then falls back to the default face.
 */
export async function loadNewsreader(text: string, weight: 400 | 500): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Newsreader:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function Flame({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1.2-.5-2-1-2.8 2.3 1 4 3.3 4 6.3a5.5 5.5 0 0 1-11 0C6.5 9.5 10 7.5 12 3Z" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function renderAltarImage(content: AltarOgContent, day: string, format: AltarImageFormat = "og") {
  const { label, dateLabel, verse, reference, title } = content;
  const p = paletteFor(day);
  const shownVerse = verse ? `“${truncate(verse, MAX_VERSE_CHARS[format])}”` : title ?? label;
  const size = VERSE_TIERS[format].find(([max]) => shownVerse.length < max)![1];
  const muted = "rgba(253,248,239,0.6)";

  // One wrapper div, not a fragment: Satori skips fragment children here,
  // which left the PNG transparent. The root's solid colour is a fallback.
  const background = (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: `linear-gradient(160deg, ${p.stops[0]} 0%, ${p.stops[1]} 55%, ${p.stops[2]} 100%)` }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: `radial-gradient(circle at 92% 108%, rgba(${p.glow},0.55) 0%, rgba(${p.glow},0.2) 32%, rgba(0,0,0,0) 62%)`,
        }}
      />
    </div>
  );

  if (format === "og") {
    return (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Newsreader, serif", color: "#fdf8ef", backgroundColor: p.stops[1] }}>
        {background}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 80px 48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: p.accent }}>
            <Flame size={30} color={p.accent} />
            <span>{label}</span>
            <span style={{ color: muted }}>{dateLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 22, maxWidth: 1000 }}>
            <div style={{ display: "flex", fontSize: size, lineHeight: 1.22, fontWeight: 500, letterSpacing: "-0.01em" }}>{shownVerse}</div>
            {reference && (
              <div style={{ display: "flex", fontSize: 28, color: p.accent }}>
                {reference}
                <span style={{ marginLeft: 10, color: muted }}>KJV</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${SITE}/logo.png`} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 9 }} />
              <div style={{ display: "flex", fontSize: 23 }}>{ALTAR_OG_BRAND}</div>
            </div>
            {verse && title && <div style={{ display: "flex", fontSize: 24, color: "rgba(253,248,239,0.8)", maxWidth: 560, textAlign: "right" }}>{truncate(title, 60)}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Post and story: a standalone graphic — it travels without a tappable
  // link, so it names the site at the foot.
  const story = format === "story";
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Newsreader, serif", color: "#fdf8ef", backgroundColor: p.stops[1] }}>
      {background}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: story ? "150px 96px 130px" : "84px 88px 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: story ? 40 : 34, color: p.accent }}>
            <Flame size={story ? 46 : 40} color={p.accent} />
            <span>{label}</span>
          </div>
          <div style={{ display: "flex", fontSize: story ? 34 : 29, color: muted }}>{dateLabel}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: story ? 40 : 30 }}>
          <div style={{ display: "flex", fontSize: size, lineHeight: 1.2, fontWeight: 500, letterSpacing: "-0.01em" }}>{shownVerse}</div>
          {reference && (
            <div style={{ display: "flex", fontSize: story ? 42 : 36, color: p.accent }}>
              {reference}
              <span style={{ marginLeft: 12, color: muted }}>KJV</span>
            </div>
          )}
          {verse && title && (
            <div style={{ display: "flex", flexDirection: "column", gap: story ? 28 : 22, marginTop: story ? 20 : 10 }}>
              <div style={{ display: "flex", width: 72, height: 3, background: p.accent, opacity: 0.7 }} />
              <div style={{ display: "flex", fontSize: story ? 44 : 38, color: "rgba(253,248,239,0.88)" }}>{truncate(title, 70)}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SITE}/logo.png`} alt="" width={story ? 60 : 52} height={story ? 60 : 52} style={{ width: story ? 60 : 52, height: story ? 60 : 52, borderRadius: 12 }} />
            <div style={{ display: "flex", fontSize: story ? 32 : 28 }}>{ALTAR_OG_BRAND}</div>
          </div>
          <div style={{ display: "flex", fontSize: story ? 32 : 28, color: p.accent }}>{ALTAR_IMAGE_DOMAIN}</div>
        </div>
      </div>
    </div>
  );
}
