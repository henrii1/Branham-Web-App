// `html-to-image` is dynamically imported here — and ONLY here — so it never
// enters the initial page bundle. This app has a hard latency-first
// requirement (see CLAUDE.md): the library is only paid for when a user
// actually clicks "Download image" in the Share modal. Do NOT hoist this to
// a static top-level `import` statement.
export async function renderCardToPng(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, { width: 1200, height: 630, pixelRatio: 2 });
  if (!blob) throw new Error("Failed to generate share card image");
  return blob;
}
