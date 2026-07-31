export interface ShareCardBackground {
  id: string;
  label: string;
  // Full CSS `background` shorthand (image + position + size), used only
  // for the small live-preview swatch buttons in ShareModal — cheap,
  // browser-rendered UI that never goes through html-to-image.
  css: string;
  // Plain path to the same image, used by ShareCardTemplate itself via a
  // real <img> tag rather than a CSS background-image. html-to-image is
  // less reliable at embedding CSS `background: url(...)` than a plain
  // <img> src across browsers (same class of issue already fixed for the
  // corner brand mark's logo icon) — an <img> is what actually gets
  // rasterized into the exported/shared card.
  src: string;
  // Which text shade reads best on this background by default — light.png
  // and grey.png are light-to-mid toned (dark text default), dark.png is
  // near-black (light text default). ShareModal auto-selects this shade
  // whenever the background changes, unless the user has manually picked
  // a shade themselves in this session — prevents the confusing "nothing
  // happened" result of a dark background under the default dark-text
  // legibility scrim, which washes a dark photo out to a muddy grey.
  defaultTextShadeId: "dark" | "light";
}

// Real backgrounds, supplied as static assets under public/share-backgrounds/.
export const SHARE_CARD_BACKGROUNDS: ShareCardBackground[] = [
  {
    id: "light",
    label: "Light",
    css: "url('/share-backgrounds/light.png') center / cover no-repeat",
    src: "/share-backgrounds/light.png",
    defaultTextShadeId: "dark",
  },
  {
    id: "grey",
    label: "Grey",
    css: "url('/share-backgrounds/grey.png') center / cover no-repeat",
    src: "/share-backgrounds/grey.png",
    defaultTextShadeId: "dark",
  },
  {
    id: "dark",
    label: "Dark",
    css: "url('/share-backgrounds/dark.png') center / cover no-repeat",
    src: "/share-backgrounds/dark.png",
    defaultTextShadeId: "light",
  },
];

export interface ShareCardTextShade {
  id: "dark" | "light";
  label: string;
  textColor: string;
  mutedColor: string;
  linkColor: string;
  // Subtle full-card overlay behind the text, so the chosen shade stays
  // legible regardless of which part of the background photo sits under
  // it — the photo is still clearly visible, just slightly dimmed/lightened.
  scrimCss: string;
}

export const SHARE_CARD_TEXT_SHADES: ShareCardTextShade[] = [
  {
    id: "dark",
    label: "Dark text",
    textColor: "#18181b",
    mutedColor: "#52525b",
    // Matches the app's own light-mode citation-pill link color
    // (globals.css .citation-pill--clickable) for brand consistency.
    linkColor: "#1d4ed8",
    scrimCss: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.74) 100%)",
  },
  {
    id: "light",
    label: "Light text",
    textColor: "#fafafa",
    mutedColor: "#d4d4d8",
    // Matches the app's own dark-mode citation-pill link color, and reads
    // as clearly distinct from the near-white text (not just from the
    // background) — a pale, desaturated blue would blend into light text.
    linkColor: "#a9b8ff",
    scrimCss: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.64) 100%)",
  },
];
