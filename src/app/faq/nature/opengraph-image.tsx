import { natureSeriesOgImage } from "@/lib/share/natureSeriesOgImage";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Christianity Seen in Nature";

export default function Image() {
  return natureSeriesOgImage("en");
}
