// Web Share helpers shared by the chat/FAQ ShareModal and the Family Altar
// AltarShareButton, so the share-sheet rules live in one place.

/** What this browser can hand to the OS share sheet. Client-only. */
export function detectWebShare(): { share: boolean; files: boolean } {
  const share = typeof navigator !== "undefined" && typeof navigator.share === "function";
  let files = false;
  try {
    files = share && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "t.png", { type: "image/png" })] });
  } catch {
    files = false;
  }
  return { share, files };
}

/**
 * Share an image through the OS share sheet.
 *
 * - `withCaption`: the caption goes along as `text` (WhatsApp, X…). The link
 *   lives in the caption, not in `url`: with a file attached apps use the
 *   text as the caption, and some drop the file when `url` is set.
 * - Without it the image goes alone and the caption is copied to the
 *   clipboard (best-effort; `onCaptionCopied` fires if it worked). The share
 *   sheet only lists apps that accept every item shared, and Instagram and
 *   TikTok don't take text — with a caption attached they never appear.
 *
 * Call it straight from the tap with nothing awaited first: iOS refuses a
 * share once the tap's activation has passed. Resolves when shared or when
 * the reader closes the sheet (AbortError); rejects on a real failure.
 */
export function shareImageFile(file: File, caption: string, withCaption: boolean, onCaptionCopied?: () => void): Promise<void> {
  if (!withCaption) {
    navigator.clipboard?.writeText(caption).then(
      () => onCaptionCopied?.(),
      () => {},
    );
  }
  return navigator.share(withCaption ? { files: [file], text: caption } : { files: [file] }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "AbortError") return;
    throw err;
  });
}
