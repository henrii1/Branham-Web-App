import { ImageResponse } from "next/og";
import { BrandMarkImage } from "@/lib/brand/BrandMarkImage";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f8",
        }}
      >
        <BrandMarkImage size={360} cornerRadius={88} />
      </div>
    ),
    size,
  );
}
