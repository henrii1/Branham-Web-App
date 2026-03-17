import { ImageResponse } from "next/og";

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
            Branham Sermons Assistant
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

        {/* App logo from public/logo.png */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://branhamsermons.ai/logo.png"
          width={280}
          height={280}
          alt=""
          style={{ borderRadius: 56, boxShadow: "0 16px 36px rgba(15,23,42,0.18)" }}
        />
      </div>
    ),
    size,
  );
}
