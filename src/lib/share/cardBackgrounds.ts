export interface ShareCardBackground {
  id: string;
  label: string;
  css: string;
}

// Placeholder gradients matching the existing opengraph-image.tsx aesthetic.
// Swap `css` for `url('/share-backgrounds/<name>.png')` once real
// nature-photo/logo-watermark assets are supplied — no other code changes
// are needed.
export const SHARE_CARD_BACKGROUNDS: ShareCardBackground[] = [
  {
    id: "light",
    label: "Light",
    css: "linear-gradient(135deg, rgb(247, 247, 248) 0%, rgb(235, 236, 241) 100%)",
  },
  {
    id: "dark",
    label: "Dark",
    css: "linear-gradient(135deg, rgb(24, 24, 27) 0%, rgb(9, 9, 11) 100%)",
  },
  {
    id: "accent",
    label: "Accent",
    css: "linear-gradient(135deg, rgb(30, 41, 99) 0%, rgb(15, 23, 42) 100%)",
  },
];
