interface BrandMarkImageProps {
  size: number;
  cornerRadius?: number;
}

export function BrandMarkImage({
  size,
  cornerRadius = 24,
}: BrandMarkImageProps) {
  const circleSize = Math.round(size * 0.26);
  const bookWidth = Math.round(size * 0.72);
  const bookHeight = Math.round(size * 0.42);
  const pageWidth = Math.round(bookWidth * 0.46);
  const pageHeight = Math.round(bookHeight * 0.86);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: size,
        height: size,
        borderRadius: cornerRadius,
        background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.2)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: Math.round(size * 0.18),
          width: circleSize,
          height: circleSize,
          borderRadius: 9999,
          background: "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)",
          boxShadow: "0 8px 18px rgba(37, 99, 235, 0.35)",
          border: "6px solid rgba(255,255,255,0.18)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: Math.round(size * 0.16),
          display: "flex",
          width: bookWidth,
          height: bookHeight,
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: pageWidth,
            height: pageHeight,
            borderRadius: "22px 10px 22px 16px",
            background: "#f8fafc",
            transform: "skewY(-8deg)",
            boxShadow: "0 10px 22px rgba(15, 23, 42, 0.18)",
          }}
        />
        <div
          style={{
            width: Math.max(8, Math.round(size * 0.03)),
            height: Math.round(bookHeight * 0.88),
            margin: "0 6px",
            borderRadius: 9999,
            background: "#cbd5e1",
          }}
        />
        <div
          style={{
            width: pageWidth,
            height: pageHeight,
            borderRadius: "10px 22px 16px 22px",
            background: "#f8fafc",
            transform: "skewY(8deg)",
            boxShadow: "0 10px 22px rgba(15, 23, 42, 0.18)",
          }}
        />
      </div>
    </div>
  );
}
