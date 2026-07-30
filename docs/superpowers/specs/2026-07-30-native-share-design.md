# Native Share (Web Share API) for the Share Card

**Date:** 2026-07-30
**Status:** Approved

## Problem

The Share modal (`ShareModal.tsx`) can only get the generated card onto WhatsApp, Instagram, or anywhere else via a manual round-trip: download the PNG, switch apps, attach the file by hand. That's real friction between "I like this card" and it actually landing in a chat or a Story, and it's the main blocker to the card feature actually driving new users in the way it's meant to.

## Goals

- Add a one-tap "Share directly" action to `ShareModal` that hands the already-rendered card image to the OS's native share sheet via the Web Share API, so the user picks WhatsApp/Instagram/Messages/whatever themselves from apps already installed on their device.
- Make it reliable: the share call must never race against slow image rasterization and silently fail.
- Fully localized (en/es/fr today; extensible the same way every other per-language surface in this app already is).
- Invisible, zero-cost degradation where the platform doesn't support it (most desktop browsers) — Copy Link and Download Image are unaffected either way.

## Non-Goals

- **No per-platform "direct to Instagram Story" / "direct to TikTok" buttons.** Researched and confirmed not reliably buildable from a plain website: neither platform exposes a public web share-intent for posting content (feed or Story) from a third-party site. The `instagram-stories://` URL scheme exists but is an undocumented-for-web, native-app-context mechanism Meta could change or break without notice — not something to build a feature around.
- **No change to Facebook's link-preview sharing.** `facebook.com/sharer.php` only ever pulls the target URL's `og:image` meta tag; it has no way to accept a custom uploaded image at all. That's pre-existing, unrelated behavior — out of scope here.
- **No server-side work.** Entirely client-side, reusing the same rendering path (`renderCardToPng`) `Download Image` already calls.
- **No relabeling of the existing Facebook/WhatsApp format toggle**, and **no card-branding-line feature** — both explicitly deferred to a separate round, per the earlier conversation.

---

## Background: what research ruled out

Before this design, the working assumption was "four buttons, one per platform, each drops the image straight into that app." That's not achievable on the web platform as it exists today:

- **The only mechanism for handing a file to another app from a website is the Web Share API** (`navigator.share()` with a `files` array). It opens the OS's own native share sheet; the list of destination apps is controlled by the OS, not by us. We can trigger *one* sheet — the user picks the destination themselves. This is a deliberate W3C design choice (anti-fingerprinting: a site must not be able to detect which apps are installed or which one the user picked), not a gap to code around.
- **User-activation timing is a real constraint.** `navigator.share()` throws `NotAllowedError` if called outside a live user-activation window. That window survives synchronous work and roughly a ~1 second grace period through things like `setTimeout`/`fetch`, but our card image is rasterized via `html-to-image`, an async DOM-to-canvas operation that can easily exceed that on a slower phone. Calling it as "click → generate → `await share()`" would work sometimes and silently fail other times — worse than not having the feature. The image must already exist as a ready `Blob` before the user taps the button.
- **Format assumption correction:** WhatsApp Status, Instagram Stories, Facebook Stories, and TikTok are *all* 1080×1920 (9:16) — the same "portrait" format this app already built, not a WhatsApp-only convention. The two card formats already in `ShareCardTemplate.tsx` (`landscape` 1200×630, `portrait` 1080×1920) already cover every platform's Story/Status convention; nothing new is needed on the format side for this feature.

---

## Design

### 1. UI placement

Confirmed via the visual-companion mockup session (Option C): **`Share directly` sits as a second full-width button directly below the existing `Download image` button**, with a small share glyph before the label. No change to the button above it, no icon overlay on the card preview itself.

```
┌─────────────────────────────┐
│  [ Download image        ]  │
│  [ ⬆ Share directly      ]  │
└─────────────────────────────┘
```

### 2. Feature detection

The button renders only when the platform genuinely supports sharing files — never a dead/disabled button taking up space on browsers that can't do this:

```ts
const nativeShareSupported =
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function";
```

This is a coarse initial check (safe to run without an actual file yet — most desktop browsers already fail here and never proceed further). The precise, file-aware check (`navigator.canShare({ files: [file] })`) happens once a real file exists, immediately before actually sharing (§5) — some browsers support text/url sharing via `navigator.share` but not file sharing specifically, so the coarse check alone isn't sufficient to promise the button will work.

### 3. Pre-generation (the latency trade-off, made explicit)

`generateShareCard.ts` currently documents a hard latency-first rule: `html-to-image` is dynamically imported *only* inside the click handler, paid for only when the user explicitly asks for it. This feature requires bending that rule slightly, and the bend needs to be narrow and justified rather than casual:

- **Only when `nativeShareSupported` is true** does `ShareModal` proactively rasterize a `Blob` in the background. Desktop users — the majority of visits, where this feature can't work anyway — never pay this cost; behavior there is byte-for-byte what it is today.
- The regeneration is debounced (~400ms after the last change) and re-triggers on the same dependencies that already invalidate the visual preview: `format`, `backgroundIndex`, `textShadeIndex`.
- A monotonically-increasing generation token (a `ref`, incremented on every trigger) guards against a stale, slow render overwriting a newer one if the user changes settings again before the first finishes — the component only commits a render's result to state if its token still matches the latest.
- The `Share directly` button is disabled with a "Generating…" label (reusing the existing `shareGenerating` string) whenever no ready `Blob` exists yet for the current settings — mirroring how `Download Image` already gates on `cardReady`.
- **`Download Image` opportunistically reuses this same pre-generated `Blob`** when one is fresh and ready (i.e., on platforms where `nativeShareSupported` is true), instead of re-rasterizing on click — a free latency win for the existing button, and it means there's only ever one rasterization in flight for a given settings combination, never two redundant ones. On platforms without native-share support, `Download Image`'s behavior is completely unchanged (renders on click, exactly as today).

### 4. Click handler

```ts
async function handleNativeShare() {
  if (!nativeShareBlob) return;
  const file = new File([nativeShareBlob], shareFilename, { type: "image/png" });
  if (!navigator.canShare({ files: [file] })) {
    setNativeShareError(true);
    return;
  }
  try {
    await navigator.share({
      files: [file],
      title: "Branham Sermons Assistant",
      text: latestQuestion,
      url: shareUrl,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return; // user backed out — not a failure
    console.error("Native share failed:", err);
    setNativeShareError(true);
  }
}
```

`shareFilename` is the same pattern `Download Image` already uses (`branham-sermons-share-${shareHash.slice(0, 8)}.png`).

### 5. What gets shared

| Field | Value | Notes |
|---|---|---|
| `files` | `[file]` | The current format/background/text-shade selection — same content `Download Image` would produce for that combination. |
| `title` | `"Branham Sermons Assistant"` | Brand name, not localized — matches existing precedent (the app's own metadata title and other brand-name usages are English/as-is across all three locales; there's no existing translated-brand-name pattern to follow instead). |
| `text` | `latestQuestion` | Already localized per the user's active chat language — an existing prop, no new plumbing. |
| `url` | `shareUrl` | Existing prop, unchanged. |

Whichever app the user picks from the OS sheet receives whatever combination of these it knows how to accept — some apps keep image + text + link together, others (Instagram has historically been inconsistent here) may take only the image and drop the rest. That's controlled entirely by the receiving app, not us, and isn't something this feature can guarantee either way.

### 6. Error handling

- `AbortError` (user backed out of the OS share sheet without picking anything) → silent no-op. This is the expected, common case, not a failure — no error UI.
- `canShare({ files: [file] })` returns false at click time (capability changed, or an edge case the coarse check missed) → show the error string, no `share()` call attempted.
- `navigator.share()` rejects for any other reason → log to console, show the error string.
- Error string uses a new key (§7), not the existing `shareDownloadError` — that string's wording ("Couldn't generate the image") is specifically about rasterization failing, which isn't the failure mode here (the image already exists by the time this path can fail).

### 7. Localization

New `chatStrings.ts` keys, added to all three language blocks (en/es/fr), following the file's existing flat key-per-language-block structure:

| Key | en | es | fr |
|---|---|---|---|
| `shareNativeButton` | Share directly | Compartir directamente | Partager directement |
| `shareNativeError` | Couldn't open the share sheet — please try again. | No se pudo abrir el panel de compartir — inténtalo de nuevo. | Impossible d'ouvrir le panneau de partage — veuillez réessayer. |

No new content-generation logic is needed beyond these two keys — everything else passed to `navigator.share()` (§5) is already-localized data flowing through existing props.

### 8. Icon

A small inline SVG share glyph (iOS-style box-with-upward-arrow, the same visual family already used elsewhere in this app's inline-SVG icon buttons, e.g. the modal's own close icon) sits before the button label, matching the visual-companion mockup exactly.

---

## Testing / verification approach

`navigator.share`/`navigator.canShare` are unavailable in headless/desktop automation contexts (Playwright's default browsers), so verification is split:

1. **Automated (Playwright, desktop):** stub `navigator.share`/`navigator.canShare` via `page.addInitScript` to simulate a supporting browser, then verify: the button renders only when the stub reports support; it stays disabled/"Generating…" until the debounced background render resolves; it re-triggers regeneration on format/background/shade changes; the click handler calls `navigator.share` with the expected `files`/`title`/`text`/`url` shape; `AbortError` produces no visible error state while other rejections do.
2. **Manual (real device):** at least one real iOS Safari and one real Android Chrome session, confirming the OS share sheet actually opens with the image attached, and that sharing to WhatsApp specifically arrives as a real image (this half can't be automated — flag it explicitly in the implementation plan as a manual verification step, not something CI or Playwright can substitute for).

## Out of Scope / Deferred

- Per-platform direct deep-links to Instagram/TikTok (confirmed infeasible from a website, see Background).
- Facebook/WhatsApp format-toggle relabeling.
- The "Branham Sermons Assistant" branding line on the card itself.
