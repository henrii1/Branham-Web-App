export interface ShareCardBackground {
  id: string;
  label: string;
  css: string;
}

// Real backgrounds, supplied as static assets under public/share-backgrounds/.
// `css` is a full CSS `background` shorthand (image + position + size), so
// ShareCardTemplate can apply it directly via `style={{ background: css }}`.
export const SHARE_CARD_BACKGROUNDS: ShareCardBackground[] = [
  {
    id: "light",
    label: "Light",
    css: "url('/share-backgrounds/light.png') center / cover no-repeat",
  },
  {
    id: "grey",
    label: "Grey",
    css: "url('/share-backgrounds/grey.png') center / cover no-repeat",
  },
  {
    id: "dark",
    label: "Dark",
    css: "url('/share-backgrounds/dark.png') center / cover no-repeat",
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
    linkColor: "#1d4ed8",
    scrimCss: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.74) 100%)",
  },
  {
    id: "light",
    label: "Light text",
    textColor: "#f4f4f5",
    mutedColor: "#d4d4d8",
    linkColor: "#93c5fd",
    scrimCss: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.64) 100%)",
  },
];
