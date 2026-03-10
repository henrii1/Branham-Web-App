import { ImageResponse } from "next/og";
import { logoDataUrl } from "@/lib/brand/logoDataUrl";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(135deg, rgb(247, 247, 248) 0%, rgb(235, 236, 241) 100%)",
          color: "#1f1f1f",
          padding: "56px 64px",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "620px",
          }}
        >
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.05,
              fontWeight: 700,
            }}
          >
            Branham Sermons AI
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#4b5563",
            }}
          >
            Ask questions grounded in the original sermon texts.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 320,
            height: 320,
            borderRadius: 56,
            background: "#ffffff",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
          }}
        >
          <img
            src={logoDataUrl}
            alt="Branham Sermons AI logo"
            width="220"
            height="220"
            style={{
              borderRadius: 40,
              objectFit: "cover",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
