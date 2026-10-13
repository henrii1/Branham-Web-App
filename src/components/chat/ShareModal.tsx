"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";
import { SHARE_CARD_BACKGROUNDS, SHARE_CARD_TEXT_SHADES } from "@/lib/share/cardBackgrounds";
import { renderCardToJpeg, renderCardToPng } from "@/lib/share/generateShareCard";
import { generateQrMatrix } from "@/lib/share/generateQrMatrix";
import { CARD_DIMENSIONS, ShareCardTemplate, type ShareCardFormat } from "./ShareCardTemplate";

// Fixed preview letterbox height — 4:5 and 9:16 cards scale-to-fit inside
// this same box instead of the modal growing to a full card's height.
const PREVIEW_BOX_HEIGHT = 360;

interface ShareModalProps {
  onClose: () => void;
  strings: ChatStrings;
  shareUrl: string;
  shareHash: string;
  // True once the background share-creation work (fetching messages,
  // writing the conversation_shares row, building the card excerpt) has
  // finished — the modal opens before this is true so the user sees the
  // link immediately instead of waiting on network round-trips.
  cardReady: boolean;
  // True if that background work failed — the displayed link and card
  // controls are non-functional in that case.
  shareError: boolean;
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
}

export function ShareModal({
  onClose,
  strings,
  shareUrl,
  shareHash,
  cardReady,
  shareError,
  firstQuestion,
  latestQuestion,
  answerExcerptHtml,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<ShareCardFormat>("portrait");
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [textShadeIndex, setTextShadeIndex] = useState(0);
  // Once the user manually picks a text shade, background changes stop
  // auto-selecting a shade for them — their choice sticks for the rest
  // of this modal session instead of being silently overridden.
  const [shadeManuallyPicked, setShadeManuallyPicked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const cardWidth = CARD_DIMENSIONS[format].width;
  const cardHeight = CARD_DIMENSIONS[format].height;

  // Web Share API, text/url only (no files) — "Share directly" hands off
  // just the link so the destination app renders its own rich link
  // preview (see docs/superpowers/specs/2026-08-03-share-card-qr-and-og-preview-design.md
  // for why a combined file+url share never actually produces both a
  // picture and a clickable preview). Detected client-only (starts false
  // to match SSR) so desktop browsers without support never render a
  // dead button.
  const [nativeShareSupported, setNativeShareSupported] = useState(false);
  const [nativeSharing, setNativeSharing] = useState(false);
  const [nativeShareError, setNativeShareError] = useState(false);
  // QR module matrix for the card's bottom-right QR code — encodes the
  // exact deep link (shareUrl), generated once since it doesn't change
  // while the modal is open. Needed for the live preview, not just
  // Download, so it's generated eagerly on mount rather than on click.
  const [qrMatrix, setQrMatrix] = useState<boolean[][] | null>(null);

  // Phones that can share files get "Share image" / "Image only" (the
  // chosen card, handed to the share sheet); everything else downloads it.
  const [canShareFiles, setCanShareFiles] = useState(false);
  // The current card, drawn ahead of the tap (see the effect below), keyed
  // by the choices it was drawn with.
  const [prepared, setPrepared] = useState<{ key: string; file: File } | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);
  const cardKey = `${format}|${backgroundIndex}|${textShadeIndex}|${shareUrl}`;
  const preparedFile = prepared?.key === cardKey ? prepared.file : null;
  const caption = `${latestQuestion}\n\n${shareUrl}`;

  useEffect(() => {
    const supported = typeof navigator !== "undefined" && typeof navigator.share === "function";
    setNativeShareSupported(supported);
    try {
      setCanShareFiles(
        supported &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [new File([""], "t.png", { type: "image/png" })] }),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Draw the card as soon as it's ready and whenever a choice changes
  // (debounced), so a tap can open the share sheet at once: iOS refuses
  // navigator.share once the tap's activation has passed, and drawing a
  // card takes a second or more.
  useEffect(() => {
    if (!canShareFiles || !cardReady || shareError || !qrMatrix) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const node = cardRef.current;
      if (!node) return;
      renderCardToJpeg(node, { width: cardWidth, height: cardHeight })
        .then((blob) => {
          if (cancelled) return;
          const file = new File([blob], `branham-sermons-${shareHash.slice(0, 8)}-${format}.jpg`, { type: "image/jpeg" });
          setPrepared({ key: cardKey, file });
        })
        .catch((err) => {
          console.error("Failed to prepare share card image:", err);
          if (!cancelled) setDownloadError(true);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [canShareFiles, cardReady, shareError, qrMatrix, cardKey, cardWidth, cardHeight, format, shareHash]);

  useEffect(() => {
    let cancelled = false;
    generateQrMatrix(shareUrl)
      .then((matrix) => {
        if (!cancelled) setQrMatrix(matrix);
      })
      .catch((err) => {
        console.error("Failed to generate QR code for share card:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  useEffect(() => {
    const el = previewWrapperRef.current;
    if (!el) return;
    // Fit within both the wrapper's width AND the fixed preview-box
    // height — tall cards scaled by width alone would blow past the box.
    const updateScale = () => {
      const scaleByWidth = el.offsetWidth / cardWidth;
      const scaleByHeight = PREVIEW_BOX_HEIGHT / cardHeight;
      setPreviewScale(Math.min(scaleByWidth, scaleByHeight));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cardWidth, cardHeight]);

  function handleBackgroundSelect(index: number) {
    setBackgroundIndex(index);
    if (!shadeManuallyPicked) {
      const defaultShadeIndex = SHARE_CARD_TEXT_SHADES.findIndex(
        (shade) => shade.id === SHARE_CARD_BACKGROUNDS[index].defaultTextShadeId,
      );
      if (defaultShadeIndex !== -1) setTextShadeIndex(defaultShadeIndex);
    }
  }

  function handleShadeSelect(index: number) {
    setTextShadeIndex(index);
    setShadeManuallyPicked(true);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!cardRef.current || !cardReady) return;
    setGenerating(true);
    setDownloadError(false);
    try {
      const blob = await renderCardToPng(cardRef.current, { width: cardWidth, height: cardHeight });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `branham-sermons-share-${shareHash.slice(0, 8)}.png`;
      // The anchor must be attached to the document for .click() to
      // reliably trigger a download in every browser (some silently
      // no-op on a detached element), and revoking the object URL must
      // wait until the browser has actually started reading it — doing
      // it synchronously right after .click() is a race that can
      // truncate/corrupt the downloaded file in some browsers, even
      // though it often appears to work in Chromium-based ones.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error("Failed to generate share card image:", err);
      setDownloadError(true);
    } finally {
      setGenerating(false);
    }
  }

  // Share the chosen card. `withCaption`: the question and link go along as
  // text (WhatsApp, X, Facebook…). Without it the image goes alone — the
  // share sheet only lists apps that accept every item, and Instagram and
  // TikTok don't take text — and the caption is copied to paste instead.
  // Called straight from the tap with nothing awaited first (see above).
  function handleShareImage(withCaption: boolean) {
    if (!preparedFile) return;
    setDownloadError(false);
    setCaptionCopied(false);
    if (!withCaption) {
      navigator.clipboard?.writeText(caption).then(
        () => setCaptionCopied(true),
        () => {},
      );
    }
    navigator.share(withCaption ? { files: [preparedFile], text: caption } : { files: [preparedFile] }).catch((err) => {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Image share failed:", err);
      setNativeShareError(true);
    });
  }

  async function handleNativeShare() {
    if (nativeSharing) return;
    setNativeSharing(true);
    setNativeShareError(false);
    try {
      await navigator.share({
        title: "Branham Sermons Assistant",
        text: latestQuestion,
        url: shareUrl,
      });
    } catch (err) {
      // The user backing out of the OS share sheet without picking
      // anything is the common case, not a failure — no error shown.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Native share failed:", err);
      setNativeShareError(true);
    } finally {
      setNativeSharing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {strings.shareModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.shareClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {shareError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {strings.shareCreateError}
          </p>
        )}

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareLinkLabel}
        </label>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={shareError}
            className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? strings.shareCopied : strings.shareCopyLink}
          </button>
        </div>

        <div
          ref={previewWrapperRef}
          className="mb-4 flex items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
          style={{ width: "100%", height: PREVIEW_BOX_HEIGHT }}
        >
          <div style={{ width: cardWidth * previewScale, height: cardHeight * previewScale }}>
            <div style={{ width: cardWidth, height: cardHeight, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <ShareCardTemplate
                ref={cardRef}
                firstQuestion={firstQuestion}
                latestQuestion={latestQuestion}
                answerExcerptHtml={answerExcerptHtml}
                backgroundSrc={SHARE_CARD_BACKGROUNDS[backgroundIndex].src}
                textShade={SHARE_CARD_TEXT_SHADES[textShadeIndex]}
                readMoreLabel={strings.shareReadMore}
                readMoreUrl={shareUrl}
                format={format}
                qrMatrix={qrMatrix}
              />
            </div>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareFormatLabel}
        </label>
        <div className="mb-4 flex gap-2">
          {(["portrait", "post", "tiktok"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-sm font-medium transition-colors ${
                format === f
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {f === "portrait" ? strings.shareFormatWhatsapp : f === "post" ? strings.shareFormatInstagram : strings.shareFormatTiktok}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareBackgroundLabel}
        </label>
        <div className="mb-4 flex gap-3">
          {SHARE_CARD_BACKGROUNDS.map((bg, i) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => handleBackgroundSelect(i)}
              aria-label={bg.label}
              aria-pressed={i === backgroundIndex}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`block h-8 w-8 rounded-full border-2 ${
                  i === backgroundIndex
                    ? "border-blue-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                style={{ background: bg.css }}
              />
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{bg.label}</span>
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareTextColorLabel}
        </label>
        <div className="mb-4 flex gap-2">
          {SHARE_CARD_TEXT_SHADES.map((shade, i) => (
            <button
              key={shade.id}
              type="button"
              onClick={() => handleShadeSelect(i)}
              aria-label={shade.label}
              aria-pressed={i === textShadeIndex}
              className={`flex h-8 w-11 items-center justify-center rounded-lg border-2 text-sm font-semibold ${
                i === textShadeIndex ? "border-blue-500" : "border-zinc-200 dark:border-zinc-700"
              }`}
              style={{
                background: shade.id === "dark" ? "#f4f4f5" : "#27272a",
                color: shade.textColor,
              }}
            >
              Aa
            </button>
          ))}
        </div>

        {canShareFiles ? (
          <>
            <button
              type="button"
              onClick={() => handleShareImage(true)}
              disabled={!preparedFile || shareError}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {preparedFile || shareError ? strings.shareImageButton : strings.shareImagePreparing}
            </button>
            <button
              type="button"
              onClick={() => handleShareImage(false)}
              disabled={!preparedFile || shareError}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {strings.shareImageOnlyButton}
            </button>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {captionCopied ? strings.shareCaptionCopied : strings.shareImageOnlyHint}
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={generating || !cardReady || shareError}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {generating || !cardReady ? strings.shareGenerating : strings.shareDownloadCard}
          </button>
        )}
        {downloadError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{strings.shareDownloadError}</p>
        )}

        {nativeShareSupported && (
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={nativeSharing || shareError}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v13m0-13 4 4m-4-4-4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
              />
            </svg>
            {strings.shareNativeButton}
          </button>
        )}
        {nativeShareError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{strings.shareNativeError}</p>
        )}
      </div>
    </div>
  );
}
