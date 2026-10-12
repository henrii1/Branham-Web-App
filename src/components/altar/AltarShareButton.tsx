"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AltarStrings } from "@/lib/altar/strings";

type ImageSize = "story" | "post";
/** The image buttons: TikTok shares the 9:16 story image, without a caption. */
type ImageTarget = ImageSize | "tiktok";
const TARGET_SIZE: Record<ImageTarget, ImageSize> = { story: "story", post: "post", tiktok: "story" };

/**
 * Share one Family Altar day. First: share it as an image (the day's
 * graphic from /api/altar/image, Status/Story 9:16 or Post 4:5) through the
 * phone's share sheet, with the link in the caption — so it shows as a
 * picture on a Status, in a channel, on Instagram or Facebook, not only
 * where an app happens to build a link preview. Without file sharing
 * (most desktops) the same buttons download the image. Below: link-only
 * shares (WhatsApp, Facebook, X, Telegram, email), copy link, More apps.
 */
export function AltarShareButton({
  url,
  title,
  verse,
  reference,
  day,
  language,
  s,
}: {
  url: string;
  title: string;
  verse: string | null;
  reference: string | null;
  day: string;
  language: string;
  s: AltarStrings;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busy, setBusy] = useState<ImageTarget | null>(null);
  const [imageError, setImageError] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Finished images, so a tap shares at once (see below).
  const [ready, setReady] = useState<Partial<Record<ImageSize, File>>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  // Images are fetched when the menu opens, so a tap can open the share
  // sheet at once: Safari refuses navigator.share once the tap is a few
  // seconds old, and drawing an image takes ~2s.
  const images = useRef<Partial<Record<ImageSize, Promise<File>>>>({});

  useEffect(() => {
    // Client-only: starts false so the server and first render match.
    const supported = typeof navigator !== "undefined" && typeof navigator.share === "function";
    let files = false;
    try {
      files = supported && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "t.png", { type: "image/png" })] });
    } catch {
      files = false;
    }
    Promise.resolve().then(() => {
      setCanNativeShare(supported);
      setCanShareFiles(files);
    });
  }, []);

  // A new day means new images.
  useEffect(() => {
    images.current = {};
    Promise.resolve().then(() => setReady({}));
  }, [day, language]);

  function loadImage(size: ImageSize): Promise<File> {
    if (!images.current[size]) {
      const p = fetch(`/api/altar/image?day=${day}&lang=${language}&format=${size}`)
        .then((r) => {
          if (!r.ok) throw new Error(`image ${r.status}`);
          return r.blob();
        })
        .then((b) => new File([b], `family-altar-${day}-${size}.png`, { type: "image/png" }));
      p.then(
        (file) => setReady((r) => ({ ...r, [size]: file })),
        () => {
          delete images.current[size];
        },
      );
      images.current[size] = p;
    }
    return images.current[size]!;
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    setImageError(false);
    setNote(null);
    if (next) {
      loadImage("story").catch(() => {});
      loadImage("post").catch(() => {});
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const quote = verse && reference ? `“${verse}” ${reference}` : "";
  const message = [title, quote].filter(Boolean).join("\n");
  const enc = encodeURIComponent;
  const targets: { label: string; href: string; icon: ReactNode }[] = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${message}\n\n${url}`)}`, icon: <WhatsAppIcon /> },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: <FacebookIcon /> },
    { label: "X", href: `https://x.com/intent/post?text=${enc(reference ? `${title} (${reference})` : title)}&url=${enc(url)}`, icon: <XIcon /> },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message)}`, icon: <TelegramIcon /> },
    { label: s.email, href: `mailto:?subject=${enc(title)}&body=${enc(`${message}\n\n${url}`)}`, icon: <MailIcon /> },
  ];

  async function shareImage(target: ImageTarget) {
    const size = TARGET_SIZE[target];
    setImageError(false);
    setNote(null);
    const file = ready[size];
    if (canShareFiles && file && target === "tiktok") {
      // The image alone: the share sheet only lists apps that accept every
      // item shared, and TikTok takes images/video but not text — so with a
      // caption attached it never appears. The caption is copied to paste.
      navigator.clipboard?.writeText(`${message}\n\n${url}`).then(
        () => setNote(s.captionCopiedTikTok),
        () => {},
      );
      navigator.share({ files: [file] }).then(
        () => {},
        (err: Error) => {
          if (err?.name !== "AbortError") setImageError(true);
        },
      );
      return;
    }
    if (canShareFiles && file) {
      // Image + caption (title, verse, link). The link goes in `text`, not
      // `url`: with a file attached, apps use the text as the caption and
      // some drop the file when `url` is set. share() is called straight
      // from the tap, nothing awaited first: iOS refuses a share once the
      // tap's activation has passed. (WhatsApp's Status can sit on
      // "Preparing…" for a while; it does post.)
      navigator.share({ files: [file], text: `${message}\n\n${url}` }).then(
        () => {},
        (err: Error) => {
          // AbortError: the reader closed the share sheet.
          if (err?.name !== "AbortError") setImageError(true);
        },
      );
      return;
    }
    setBusy(target);
    try {
      const loaded = await loadImage(size);
      if (canShareFiles) {
        // Image just finished: the tap is too old to share now; the button
        // is ready for a second tap.
        return;
      }
      const href = URL.createObjectURL(loaded);
      const a = document.createElement("a");
      a.href = href;
      a.download = loaded.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      setImageError(true);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard refused; the link is still in the address bar */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: message, url });
      setOpen(false);
    } catch {
      /* AbortError: the reader closed the share sheet */
    }
  }

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <ShareIcon />
        {s.share}
      </button>
      {open && (
        <div role="menu" aria-label={s.shareTitle} className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-[var(--surface-base)] p-1.5 shadow-lg dark:border-zinc-700">
          <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{canShareFiles ? s.shareImage : s.downloadImage}</p>
          <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-1.5">
            {(["story", "post", "tiktok"] as const).map((target) => {
              const preparing = busy === target || (canShareFiles && !ready[TARGET_SIZE[target]] && !imageError);
              return (
                <button
                  key={target}
                  type="button"
                  role="menuitem"
                  disabled={busy !== null || (canShareFiles && !ready[TARGET_SIZE[target]] && !imageError)}
                  onClick={() => shareImage(target)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 px-1.5 py-2.5 text-center text-xs leading-tight font-medium text-foreground hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {target === "tiktok" ? (
                    <span aria-hidden="true" className="grid h-7 place-items-center opacity-80"><TikTokIcon /></span>
                  ) : (
                    <span aria-hidden="true" className={`rounded-[3px] border-2 border-current opacity-70 ${target === "story" ? "h-7 w-4" : "h-6 w-5"}`} />
                  )}
                  {preparing ? s.preparingImage : target === "story" ? s.storySize : target === "post" ? s.postSize : "TikTok"}
                </button>
              );
            })}
          </div>
          {imageError && <p role="alert" className="px-3 pb-1.5 text-xs text-red-600 dark:text-red-400">{s.imageFailed}</p>}
          {note && <p aria-live="polite" className="px-3 pb-1.5 text-xs text-zinc-600 dark:text-zinc-300">{note}</p>}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <p className="px-3 pt-1 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{s.shareLinkOnly}</p>
          {targets.map((t) => (
            <a key={t.label} role="menuitem" href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
              <span className="grid h-5 w-5 place-items-center text-zinc-500 dark:text-zinc-400">{t.icon}</span>
              {t.label}
            </a>
          ))}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button type="button" role="menuitem" onClick={copyLink} className={item}>
            <span className="grid h-5 w-5 place-items-center text-zinc-500 dark:text-zinc-400"><LinkIcon /></span>
            <span aria-live="polite">{copied ? s.linkCopied : s.copyLink}</span>
          </button>
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={nativeShare} className={item}>
              <span className="grid h-5 w-5 place-items-center text-zinc-500 dark:text-zinc-400"><MoreIcon /></span>
              {s.moreApps}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const svg = "h-4 w-4";

function ShareIcon() {
  return (
    <svg className={svg} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12 4 4m-4-4L8 7M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg className={svg} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.2 10.8a3.5 3.5 0 0 0-5 0l-2.6 2.6a3.5 3.5 0 0 0 5 5l1-1m-.8-6.2a3.5 3.5 0 0 0 5 0l2.6-2.6a3.5 3.5 0 0 0-5-5l-1 1" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg className={svg} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.3 6.3 0 1 0 5.3 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7Z" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg className={svg} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 4.2 18.4 19.4c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.1 13.1 1.4 11.6c-1-.3-1-1 .2-1.5L20.2 3c.9-.3 1.6.2 1.4 1.2Z" />
    </svg>
  );
}
