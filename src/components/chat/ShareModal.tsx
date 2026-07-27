"use client";

import { useRef, useState } from "react";
import type { ChatStrings } from "@/lib/i18n/chatStrings";
import { SHARE_CARD_BACKGROUNDS, SHARE_CARD_TEXT_SHADES } from "@/lib/share/cardBackgrounds";
import { renderCardToPng } from "@/lib/share/generateShareCard";
import { ShareCardTemplate } from "./ShareCardTemplate";

interface ShareModalProps {
  onClose: () => void;
  strings: ChatStrings;
  shareUrl: string;
  shareHash: string;
  firstQuestion: string | null;
  latestQuestion: string;
  answerExcerptHtml: string;
}

export function ShareModal({
  onClose,
  strings,
  shareUrl,
  shareHash,
  firstQuestion,
  latestQuestion,
  answerExcerptHtml,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [textShadeIndex, setTextShadeIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const blob = await renderCardToPng(cardRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `branham-sermons-share-${shareHash.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
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
            className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? strings.shareCopied : strings.shareCopyLink}
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {strings.shareBackgroundLabel}
        </label>
        <div className="mb-4 flex gap-2">
          {SHARE_CARD_BACKGROUNDS.map((bg, i) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => setBackgroundIndex(i)}
              aria-label={bg.label}
              className={`h-8 w-8 rounded-full border-2 ${
                i === backgroundIndex ? "border-blue-500" : "border-transparent"
              }`}
              style={{ background: bg.css }}
            />
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
              onClick={() => setTextShadeIndex(i)}
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
          disabled={generating}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {generating ? strings.shareGenerating : strings.shareDownloadCard}
        </button>

        <div style={{ position: "fixed", top: -9999, left: -9999 }} aria-hidden="true">
          <ShareCardTemplate
            ref={cardRef}
            firstQuestion={firstQuestion}
            latestQuestion={latestQuestion}
            answerExcerptHtml={answerExcerptHtml}
            backgroundCss={SHARE_CARD_BACKGROUNDS[backgroundIndex].css}
            textShade={SHARE_CARD_TEXT_SHADES[textShadeIndex]}
            readMoreLabel="Read more"
            readMoreUrl={shareUrl}
          />
        </div>
      </div>
    </div>
  );
}
