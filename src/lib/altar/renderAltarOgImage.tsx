// Link-preview image for one Family Altar day (/altar/[day] and
// /[lang]/altar/[day] opengraph-image.tsx) — what WhatsApp, Facebook, X,
// Telegram, iMessage etc. show when a day's link is shared. Rendered by
// next/og (Satori): inline styles, flexbox and absolute positioning only.
// The verse is the hero, set in Newsreader (the site's display face) on a
// painted dawn glow; date and reference above and below, brand at the foot.
// No photo: WhatsApp drops preview images over ~300 KB, and a photo PNG is
// ~900 KB, while gradients compress to a fraction of that.

const SITE = "https://branhamsermons.ai";
const MAX_VERSE_CHARS = 380;

export const ALTAR_OG_SIZE = { width: 1200, height: 630 };
export const ALTAR_OG_BRAND = "Branham Sermons Assistant";

export interface AltarOgContent {
  /** "Family Altar" in the page's language. */
  label: string;
  /** Long date in the page's language, e.g. "Monday, October 12". */
  dateLabel: string;
  verse: string | null;
  reference: string | null;
  title: string | null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.8 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}

// Shorter verses fill the card at a larger size.
function verseSize(chars: number): number {
  if (chars < 110) return 58;
  if (chars < 180) return 50;
  if (chars < 260) return 43;
  return 37;
}

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

export function renderAltarOgImage({ label, dateLabel, verse, reference, title }: AltarOgContent) {
  const shownVerse = verse ? `“${truncate(verse, MAX_VERSE_CHARS)}”` : title ?? label;
  const size = verseSize(shownVerse.length);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Newsreader, serif", color: "#fdf8ef" }}>
      {/* Night sky warming to dawn at the lower right. */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(160deg, #1b1410 0%, #2a1b12 55%, #4a2a14 100%)" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "radial-gradient(circle at 92% 108%, rgba(246,177,92,0.55) 0%, rgba(214,120,52,0.22) 32%, rgba(27,20,16,0) 62%)",
        }}
      />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 80px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#f6c87a" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f6c87a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1.2-.5-2-1-2.8 2.3 1 4 3.3 4 6.3a5.5 5.5 0 0 1-11 0C6.5 9.5 10 7.5 12 3Z" />
            <path d="M5 21h14" />
          </svg>
          <span>{label}</span>
          <span style={{ color: "rgba(253,248,239,0.55)" }}>{dateLabel}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 22, maxWidth: 1000 }}>
          <div style={{ display: "flex", fontSize: size, lineHeight: 1.22, fontWeight: 500, letterSpacing: "-0.01em" }}>{shownVerse}</div>
          {reference && (
            <div style={{ display: "flex", fontSize: 28, color: "#f6c87a" }}>
              {reference}
              <span style={{ marginLeft: 10, color: "rgba(253,248,239,0.55)" }}>KJV</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SITE}/logo.png`} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 9 }} />
            <div style={{ display: "flex", fontSize: 23 }}>{ALTAR_OG_BRAND}</div>
          </div>
          {verse && title && (
            <div style={{ display: "flex", fontSize: 24, color: "rgba(253,248,239,0.8)", maxWidth: 560, textAlign: "right" }}>{truncate(title, 60)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
