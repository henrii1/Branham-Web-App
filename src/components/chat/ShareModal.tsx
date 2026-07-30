"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";
import { SHARE_CARD_BACKGROUNDS, SHARE_CARD_TEXT_SHADES } from "@/lib/share/cardBackgrounds";
import { renderCardToPng } from "@/lib/share/generateShareCard";
import { CARD_DIMENSIONS, ShareCardTemplate, type ShareCardFormat } from "./ShareCardTemplate";

// Fixed preview letterbox height — both landscape (wide, short) and
// portrait (narrow, tall) cards scale-to-fit inside this same box instead
// of the modal growing to whatever height a 9:16 card would need.
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
  const [format, setFormat] = useState<ShareCardFormat>("landscape");
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

  // Web Share API (navigator.share with files) — only meaningful on
  // platforms that can hand a file to another app. Detected client-only
  // (starts false to match SSR) so desktop browsers never render a dead
  // button. See docs/superpowers/specs/2026-07-30-native-share-design.md.
  const [nativeShareSupported, setNativeShareSupported] = useState(false);
  // Proactively rasterized, ready to hand off the instant the user taps
  // Share — navigator.share() must fire within a live user-activation
  // window, and rasterizing on click would frequently miss it.
  const [nativeShareBlob, setNativeShareBlob] = useState<Blob | null>(null);
  const [nativeSharing, setNativeSharing] = useState(false);
  const [nativeShareError, setNativeShareError] = useState(false);
  // Guards against a slow, now-superseded render overwriting a newer one —
  // only the most recently triggered generation is allowed to commit.
  const nativeShareGenerationRef = useRef(0);

  useEffect(() => {
    setNativeShareSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function",
    );
  }, []);

  useEffect(() => {
    if (!nativeShareSupported || !cardReady || shareError) return;
    // Invalidate immediately (not just after the debounce fires) so
    // Download's blob-reuse below can never hand out a stale image for
    // the format/background/shade combination that's on screen right now.
    setNativeShareBlob(null);
    const token = ++nativeShareGenerationRef.current;
    const timer = setTimeout(() => {
      const node = cardRef.current;
      if (!node) return;
      renderCardToPng(node, { width: cardWidth, height: cardHeight })
        .then((blob) => {
          if (nativeShareGenerationRef.current === token) setNativeShareBlob(blob);
        })
        .catch((err) => {
          console.error("Failed to pre-generate share image for native share:", err);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [nativeShareSupported, cardReady, shareError, format, backgroundIndex, textShadeIndex, cardWidth, cardHeight]);

  useEffect(() => {
    const el = previewWrapperRef.current;
    if (!el) return;
    // Fit within both the wrapper's width AND the fixed preview-box
    // height — portrait cards are 3x taller per unit width than
    // landscape, so scaling by width alone would blow past the box.
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
      // Reuse the pre-generated native-share blob when it's ready and
      // fresh (cleared synchronously on any format/background/shade
      // change — see the effect above) instead of rasterizing twice.
      // Platforms without native-share support never populate it, so
      // this falls through to the original on-click render unchanged.
      const blob = nativeShareBlob ?? (await renderCardToPng(cardRef.current, { width: cardWidth, height: cardHeight }));
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

  async function handleNativeShare() {
    if (!nativeShareBlob || nativeSharing) return;
    setNativeSharing(true);
    setNativeShareError(false);
    try {
      const file = new File([nativeShareBlob], `branham-sermons-share-${shareHash.slice(0, 8)}.png`, {
        type: "image/png",
      });
      if (!navigator.canShare({ files: [file] })) {
        setNativeShareError(true);
        return;
      }
      await navigator.share({
        files: [file],
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
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
                backgroundCss={SHARE_CARD_BACKGROUNDS[backgroundIndex].css}
                textShade={SHARE_CARD_TEXT_SHADES[textShadeIndex]}
                readMoreLabel={strings.shareReadMore}
                readMoreUrl={shareUrl}
                format={format}
              />
            </div>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareFormatLabel}
        </label>
        <div className="mb-4 flex gap-2">
          {(["landscape", "portrait"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                format === f
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {f === "landscape" ? strings.shareFormatFacebook : strings.shareFormatWhatsapp}
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

        <button
          type="button"
          onClick={handleDownload}
          disabled={generating || !cardReady || shareError}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {generating || !cardReady ? strings.shareGenerating : strings.shareDownloadCard}
        </button>
        {downloadError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{strings.shareDownloadError}</p>
        )}

        {nativeShareSupported && (
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!nativeShareBlob || nativeSharing || shareError}
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
            {!nativeShareBlob || nativeSharing ? strings.shareGenerating : strings.shareNativeButton}
          </button>
        )}
        {nativeShareError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{strings.shareNativeError}</p>
        )}
      </div>
    </div>
  );
}
