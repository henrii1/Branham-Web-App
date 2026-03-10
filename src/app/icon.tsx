import { ImageResponse } from "next/og";
import { logoDataUrl } from "@/lib/brand/logoDataUrl";

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            height: 420,
            borderRadius: 96,
            background: "#ffffff",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
          }}
        >
          <img
            src={logoDataUrl}
            alt="Branham Sermons AI logo"
            width="320"
            height="320"
            style={{
              borderRadius: 72,
              objectFit: "cover",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
