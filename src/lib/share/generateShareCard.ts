// `html-to-image` is dynamically imported here — and ONLY here — so it never
// enters the initial page bundle. This app has a hard latency-first
// requirement (see CLAUDE.md): the library is only paid for once the Share
// modal is open. Do NOT hoist this to a static top-level `import` statement.

// Safari's engine (every browser on iPhone, Chrome included — its user agent
// says CriOS, not Chrome) often leaves <img> content out of the first
// html-to-image draw, so the card came out with a blank white background.
function isWebKitOnly(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome\/|Chromium|Edg\//.test(ua);
}

// Every <img> in the card loaded and decoded before drawing, so the
// background photo and logo are in the snapshot.
async function imagesReady(node: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
      await img.decode().catch(() => {});
    }),
  );
}

async function drawCard(node: HTMLElement, dimensions: { width: number; height: number }, pixelRatio: number): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  await imagesReady(node);
  const options = { width: dimensions.width, height: dimensions.height, pixelRatio };
  // On WebKit, the first draw primes its image cache; the second has them.
  if (isWebKitOnly()) await toCanvas(node, options);
  return toCanvas(node, options);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to generate share card image"))), type, quality),
  );
}

/** Download image (desktops): a PNG at 2×. */
export async function renderCardToPng(node: HTMLElement, dimensions: { width: number; height: number }): Promise<Blob> {
  return canvasToBlob(await drawCard(node, dimensions, 2), "image/png");
}

// For sharing (rather than downloading): a JPEG at the platform's own size.
// The PNG at pixelRatio 2 is 3–7 MB, past X's 5 MB photo limit and slow to
// hand to any app; this is a few hundred KB. Portrait cards are already
// full-screen story size (1080×1920), so they render at 1×; the smaller
// landscape card keeps 2× for sharpness.
export async function renderCardToJpeg(node: HTMLElement, dimensions: { width: number; height: number }): Promise<Blob> {
  return canvasToBlob(await drawCard(node, dimensions, dimensions.height > dimensions.width ? 1 : 2), "image/jpeg", 0.9);
}
