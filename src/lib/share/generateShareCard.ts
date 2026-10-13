// `html-to-image` is dynamically imported here — and ONLY here — so it never
// enters the initial page bundle. This app has a hard latency-first
// requirement (see CLAUDE.md): the library is only paid for once the Share
// modal is open. Do NOT hoist this to a static top-level `import` statement.

// Pictures are never drawn by html-to-image. On Safari's engine (every
// browser on iPhone, Chrome included) it embeds <img> content into an SVG
// snapshot that WebKit often draws before those images decode — the shared
// card came out as text on a blank scrim, even with load/decode waits and
// repeated draws (those passed in a simulator but not on a real iPhone).
// So the card is composed on a canvas instead:
//   1. a copy of the card with every <img> swapped for an empty placeholder
//      of the same size is snapshotted (text, scrim, pills, QR — no images);
//   2. full-card images (the background photo) are painted first with the
//      plain 2D canvas API, which draws a loaded <img> reliably everywhere;
//   3. the snapshot goes on top, then the other images (the logo) are
//      painted into their placeholders' boxes.

// Every <img> in the card loaded and decoded before drawing.
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

interface PlacedImage {
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
  cover: boolean;
  radius: number;
}

function paintImage(ctx: CanvasRenderingContext2D, { img, x, y, w, h, cover, radius }: PlacedImage) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh || !w || !h) return;
  let sx = 0;
  let sy = 0;
  let sw = nw;
  let sh = nh;
  if (cover) {
    const scale = Math.max(w / nw, h / nh);
    sw = w / scale;
    sh = h / scale;
    sx = (nw - sw) / 2;
    sy = (nh - sh) / 2;
  }
  ctx.save();
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

async function drawCard(node: HTMLElement, dimensions: { width: number; height: number }, pixelRatio: number): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  await imagesReady(node);

  // Unscaled copy off screen (the preview is CSS-scaled; the copy is not),
  // with each <img> replaced by an empty box that keeps its layout.
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-30000px;top:0;pointer-events:none;";
  const copy = node.cloneNode(true) as HTMLElement;
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    const originals = Array.from(node.querySelectorAll("img"));
    const boxes = Array.from(copy.querySelectorAll("img")).map((imgCopy, i) => {
      const box = document.createElement("div");
      box.style.cssText = imgCopy.style.cssText;
      if (imgCopy.getAttribute("width")) box.style.width ||= `${imgCopy.getAttribute("width")}px`;
      if (imgCopy.getAttribute("height")) box.style.height ||= `${imgCopy.getAttribute("height")}px`;
      box.style.flexShrink = "0";
      box.style.background = "transparent";
      imgCopy.replaceWith(box);
      return { box, img: originals[i] };
    });

    const origin = copy.getBoundingClientRect();
    const placed: PlacedImage[] = boxes.map(({ box, img }) => {
      const r = box.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {
        img,
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
        cover: cs.objectFit === "cover",
        radius: parseFloat(cs.borderTopLeftRadius) || 0,
      };
    });

    const snapshot = await toCanvas(copy, { width: dimensions.width, height: dimensions.height, pixelRatio });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(dimensions.width * pixelRatio);
    canvas.height = Math.round(dimensions.height * pixelRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    ctx.scale(pixelRatio, pixelRatio);
    const fullCard = (p: PlacedImage) => p.w >= dimensions.width - 1 && p.h >= dimensions.height - 1;
    placed.filter(fullCard).forEach((p) => paintImage(ctx, p));
    ctx.drawImage(snapshot, 0, 0, dimensions.width, dimensions.height);
    placed.filter((p) => !fullCard(p)).forEach((p) => paintImage(ctx, p));
    return canvas;
  } finally {
    holder.remove();
  }
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
// hand to any app; this is a few hundred KB. The cards are already at
// their platforms' full size (1080 wide), so they render at 1×.
export async function renderCardToJpeg(node: HTMLElement, dimensions: { width: number; height: number }): Promise<Blob> {
  return canvasToBlob(await drawCard(node, dimensions, dimensions.height > dimensions.width ? 1 : 2), "image/jpeg", 0.9);
}
