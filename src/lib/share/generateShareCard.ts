// `html-to-image` is dynamically imported here — and ONLY here — so it never
// enters the initial page bundle. This app has a hard latency-first
// requirement (see CLAUDE.md): the library is only paid for when a user
// actually clicks "Download image" in the Share modal. Do NOT hoist this to
// a static top-level `import` statement.
export async function renderCardToPng(
  node: HTMLElement,
  dimensions: { width: number; height: number },
): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    width: dimensions.width,
    height: dimensions.height,
    pixelRatio: 2,
  });
  if (!blob) throw new Error("Failed to generate share card image");
  return blob;
}

// For sharing (rather than downloading): a JPEG at the platform's own size.
// The PNG at pixelRatio 2 is 3–7 MB, past X's 5 MB photo limit and slow to
// hand to any app; this is a few hundred KB. Portrait cards are already
// full-screen story size (1080×1920), so they render at 1×; the smaller
// landscape card keeps 2× for sharpness. Same dynamic-import rule as above.
export async function renderCardToJpeg(
  node: HTMLElement,
  dimensions: { width: number; height: number },
): Promise<Blob> {
  const { toCanvas } = await import("html-to-image");
  const canvas = await toCanvas(node, {
    width: dimensions.width,
    height: dimensions.height,
    pixelRatio: dimensions.height > dimensions.width ? 1 : 2,
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Failed to generate share card image");
  return blob;
}
