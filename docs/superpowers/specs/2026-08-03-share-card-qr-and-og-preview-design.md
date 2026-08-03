# Share Card QR Code & Dynamic Link Previews

**Date:** 2026-08-03
**Status:** Approved

## Problem

The share card (PNG) has no clickable link — a recipient who only receives the image has no practical way back to the site, since the on-card URL is too long to read or type by hand. Investigating how "Share directly" behaves on WhatsApp specifically also surfaced a deeper issue: attaching an image via `navigator.share({ files, url, text })` never produces a rich link preview alongside it — WhatsApp (and platforms generally) either shows the file as an image-with-caption (URL as inert text) or, if no file is attached, unfurls a bare URL into a proper clickable preview card. You get one or the other, never both from a single combined share. Meanwhile every page that could be shared today (`/share/[hash]`, `/q/[slug]`) falls back to one static, generic, site-wide Open Graph image — no per-conversation title or excerpt — for any plain link paste.

Separately, the card's answer excerpt has a text-justify bug: `text-align: justify` is applied whenever the excerpt is long enough to wrap (>80 total chars), but justify stretches every line except the one explicitly marked `textAlignLast` — so a short *non-final* line created by a natural mid-paragraph wrap gets oversized, ugly gaps between its few words.

## Goals

- The downloadable/native-shared card becomes self-contained: a QR code pointing at the exact deep link, plus a short, readable on-card domain.
- "Share directly" becomes a pure link-share (`navigator.share({ url, text, title })`, no file), so WhatsApp/iMessage/Telegram/Slack/etc. render a real, tappable link-preview card instead of an unclickable picture.
- `/share/[hash]` and `/q/[slug]` (and their `/[lang]/` variants) get dynamic, per-page Open Graph preview images (title + plain-text excerpt), replacing the current generic static image — this is what "Share directly" and any plain copy-paste-link sharing actually render.
- Fix the card's justify-on-short-lines bug.

## Non-Goals

- No QR code on the Open Graph preview image itself — that image only ever appears alongside an already-tappable link, so a QR there would solve a problem that doesn't exist in that flow.
- No change to `Copy Link` or `Download Image`'s triggers/placement in `ShareModal`.
- No change to card dimensions, background photos, dynamic font-size tiers, or the corner brand mark from prior rounds.
- No reopening of per-platform direct-share deep links (Instagram/TikTok) — already investigated and ruled out in the native-share round.
- No new caching/CDN configuration for the OG image routes beyond Next's default per-URL behavior — not a known problem to solve yet.

## Background: why "attach image + url" doesn't get you both

Tested by reasoning through the two WhatsApp share surfaces a `navigator.share({ files, url, text })` call can land on:

- **WhatsApp Status** has no URL field at all — it shows only the image, with `text` (if used at all) as a plain, non-interactive caption. No link preview is possible here regardless of what's sent. This is the one case a QR code genuinely solves — a recipient with only the exported picture, no accompanying tappable link.
- **WhatsApp chat** (sharing to a contact/group): when a file is part of the share payload, WhatsApp sends it as an image message with `text` as a plain caption underneath — it does not additionally unfurl `url` into a separate OG-preview card. Link-preview unfurling only happens when a bare URL is the *entire* shared content (typed, pasted, or shared via `navigator.share({ url, text })` with no file).

So a combined image+url native share never delivers "picture AND rich preview" — it's one or the other depending on which surface the user picks. The redesign leans into that: "Share directly" drops the file and becomes a pure link-share (reliable OG-preview everywhere), while `Download Image` — the deliberate, explicit "I want a picture" action — is where the QR code belongs.

## Design

### 1. Card fixes — `src/components/chat/ShareCardTemplate.tsx`

**Drop justify.** Remove the `answerWraps` variable and the `textAlign: answerWraps ? "justify" : "center"` conditional (and the now-unused `textAlignLast: "center"`) — always `textAlign: "center"`. Centered text has no equivalent failure mode regardless of where the browser's line-wrap lands.

**Shorten the on-card URL.** Replace:
```tsx
{readMoreLabel} → {readMoreUrl}
```
with a bare-domain version, derived from the URL rather than hardcoded (robust to preview/staging domains):
```tsx
const shortReadMoreUrl = new URL(readMoreUrl).host; // e.g. "branhamsermons.ai"
...
{readMoreLabel} → {shortReadMoreUrl}
```

**QR code, bottom-right.** New prop `qrMatrix: boolean[][] | null` (null while generating — render nothing, since it resolves quickly and the modal is already gated on `cardReady`). Positioned as an absolutely-positioned sibling of the existing corner brand mark, mirrored to the opposite corner:
```tsx
{qrMatrix && (
  <div
    style={{
      position: "absolute",
      right: paddingX,
      bottom: paddingY,
      display: "grid",
      gridTemplateColumns: `repeat(${qrMatrix.length}, 1fr)`,
      width: qrSize,
      height: qrSize,
      background: "#ffffff",
      padding: qrSize * 0.08,
    }}
  >
    {qrMatrix.flatMap((row, r) =>
      row.map((dark, c) => (
        <div key={`${r}-${c}`} style={{ background: dark ? "#18181b" : "#ffffff" }} />
      )),
    )}
  </div>
)}
```
`qrSize`: `format === "portrait" ? 96 : 76` (roughly matches the brand mark's visual weight at each format's padding scale). Fixed white background + dark modules regardless of `textShade` — QR scannability requires guaranteed contrast; deriving it from the card's light/dark text shade would risk a low-contrast code on some background/shade combinations.

**QR generation** — new `src/lib/share/generateQrMatrix.ts`, following `generateShareCard.ts`'s dynamic-import-only precedent (`ShareModal`/`ShareCardTemplate` are statically imported into `ChatShell`, so a static import of the QR library would land in the main chat bundle):
```ts
export async function generateQrMatrix(value: string): Promise<boolean[][]> {
  const qrcode = (await import("qrcode-generator")).default;
  const qr = qrcode(0, "M"); // 0 = auto type-number (smallest that fits), M = medium error correction
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const cells: boolean[] = [];
    for (let col = 0; col < count; col++) cells.push(qr.isDark(row, col));
    matrix.push(cells);
  }
  return matrix;
}
```
New dependency: `qrcode-generator` (v2.0.4, zero dependencies, ships its own `.d.ts`, `export = qrcode` factory — confirmed via its published type declarations: `qrcode(typeNumber, errorCorrectionLevel) => { addData, make, getModuleCount, isDark, ... }`).

`ShareModal` calls `generateQrMatrix(shareUrl)` once in a `useEffect` on mount (or whenever `shareUrl` changes — it won't, in practice, within one modal session), stores the result in `qrMatrix` state, passes it to `ShareCardTemplate`. Unlike the card's background/format/shade, the QR target URL never changes while the modal is open, so this runs once — no debounce needed.

### 2. "Share directly" becomes pure link-share — `src/components/chat/ShareModal.tsx`

Delete: `nativeShareBlob` state, the debounced pre-generation `useEffect` (currently re-triggers on `format`/`backgroundIndex`/`textShadeIndex`/`cardWidth`/`cardHeight`), `nativeShareGenerationRef`. `Download Image`'s opportunistic-reuse-of-the-native-share-blob optimization goes with it — `handleDownload` goes back to always rasterizing on click, exactly as it worked before the native-share feature existed.

Feature detection simplifies:
```ts
const nativeShareSupported = typeof navigator !== "undefined" && typeof navigator.share === "function";
```
(No `canShare` file-capability check — irrelevant once there's no file. This also *widens* where the button appears, since text/url sharing is supported more broadly than file-sharing, e.g. desktop Chrome/Edge on Windows.)

New click handler:
```ts
async function handleNativeShare() {
  setNativeSharing(true);
  setNativeShareError(false);
  try {
    await navigator.share({ title: "Branham Sermons Assistant", text: latestQuestion, url: shareUrl });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    console.error("Native share failed:", err);
    setNativeShareError(true);
  } finally {
    setNativeSharing(false);
  }
}
```
Button is no longer gated on a pre-generated blob — just `disabled={nativeSharing}`. Existing `shareNativeButton`/`shareNativeError` strings, icon, and placement (below Download Image) are unchanged.

### 3. Dynamic Open Graph preview images

New shared renderer, `src/lib/share/renderOgImage.tsx` — plain Satori-compatible JSX (inline styles only, same constraint `ShareCardTemplate` already follows: flexbox + absolute positioning + explicit pixel values, no Tailwind classes), exported as a function taking the pre-built content and returning the JSX tree consumed by `next/og`'s `ImageResponse`:
```ts
export function renderOgImage({ question, excerptText }: { question: string; excerptText: string }): JSX.Element
```
Visual content: question (bold serif title, reusing the app's Fraunces treatment), `excerptText` below it (plain text, smaller), logo image (fetched by absolute URL, same pattern the existing root `opengraph-image.tsx` already uses for `https://branhamsermons.ai/logo.png`). Background: the existing "light" background photo + white scrim, for visual consistency with the downloadable card (same asset, one `fetch()` inside the route — small latency cost, paid once per unique URL since Next.js caches per-params route output). No QR code (see Non-Goals).

**Plain-text excerpt** — `src/lib/share/cardExcerpt.ts` currently does all truncation/fallback-evidence work on plain markdown text (`excerptWithEvidence`) and only applies `renderMarkdown`/`applyCitations` (HTML citation-pill styling, which Satori cannot render) as the final step. Refactor to extract the shared part:
```ts
function buildExcerptWithEvidence(rawAnswer: string): string {
  // existing body of buildCardAnswerExcerpt, up to and including
  // computing `excerptWithEvidence` — unchanged logic, just extracted
}

export function buildCardAnswerExcerpt(rawAnswer: string): string {
  return applyCitations(renderMarkdown(buildExcerptWithEvidence(rawAnswer)));
}

export function buildOgExcerptText(rawAnswer: string): string {
  return buildExcerptWithEvidence(rawAnswer)
    .replace(/^#{1,6}\s+/gm, "")   // heading markers
    .replace(/^>\s?/gm, "")        // blockquote markers
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\n{2,}/g, " ")       // collapse paragraph breaks to a single readable line
    .trim();
}
```
Citation brackets (`[TITLE — DATE: ¶N]`) are left as plain visible text — no styling needed outside `applyCitations`, and they read fine as plain text in a small preview thumbnail.

**Four thin route files**, each fetching its own data and calling the two shared pieces above:
- `src/app/share/[hash]/opengraph-image.tsx` — `fetchShareByHash(hash)` for `title_snapshot`, `fetchSharedMessages(hash)` for the latest `role === "assistant"` message's `content` (the actual answer text to excerpt — the share row itself only stores RAG/summary snapshots, not the message content).
- `src/app/[lang]/share/[hash]/opengraph-image.tsx` — same, `lang` param passed through only for any future language-specific chrome (title/excerpt content is already whatever language the conversation was in).
- `src/app/q/[slug]/opengraph-image.tsx` — `fetchSeoPage(slug)` for `question` and `answer_markdown` directly (both already plain fields on `SeoCacheRow`, no second fetch needed).
- `src/app/[lang]/q/[slug]/opengraph-image.tsx` — `fetchSeoPage(slug, lang)`.

Each exports the standard special-file shape:
```tsx
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const share = await fetchShareByHash(hash);
  if (!share) return new ImageResponse(renderOgImage({ question: "Branham Sermons Assistant", excerptText: "Ask questions grounded in the original sermon texts." }), size);
  const messages = await fetchSharedMessages(hash);
  const latestAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  return new ImageResponse(
    renderOgImage({ question: share.title_snapshot ?? "Shared conversation", excerptText: buildOgExcerptText(latestAnswer) }),
    size,
  );
}
```
Not-found (deleted conversation, bad hash/slug) falls back to the same generic content the current static root image shows — never a 500.

**Deployment risk to verify early:** the existing root `opengraph-image.tsx` proves `next/og`'s `ImageResponse` works under this app's OpenNext/Cloudflare Workers deployment (CLAUDE.md's "no per-route edge runtime" constraint), but that one is static (no dynamic segment params). Per-segment `opengraph-image.tsx` files under `[hash]`/`[slug]` routes are standard, well-documented Next.js App Router behavior, but should be smoke-tested (`npm run build` + `npm run preview`) early in implementation rather than assumed, since it's the one piece of this design without an existing proof-of-concept in this codebase.

## Testing / verification approach

- **Card fixes**: Playwright, live DOM + actual `html-to-image` rasterized output (same method used to verify the corner brand mark) across landscape/portrait, light/dark backgrounds, short/long excerpts — confirm no justify-stretch on any wrapped line, on-card URL shows bare domain, QR renders with correct proportions and doesn't overlap the brand mark. QR *content* verified by actually decoding a captured QR with a phone camera or a QR-reading library against a rasterized export — visual presence alone doesn't confirm it encodes the right URL.
- **Share directly**: Playwright with `navigator.share` stubbed (same pattern as the original native-share round) — confirm the call now carries no `files`, only `title`/`text`/`url`; confirm the button is no longer gated on any async blob-readiness state; confirm `AbortError` stays silent and other errors surface `shareNativeError`.
- **OG images**: fetch each of the 4 route shapes directly (real share hash + real `/q/` slug) and inspect the returned PNG; confirm the not-found fallback path (bogus hash/slug) renders the generic fallback instead of erroring; spot-check by pasting a real URL into a chat app (or using a link-preview debugger) to confirm the metadata is actually picked up.

## Out of Scope / Deferred

- The Facebook/WhatsApp format-toggle relabeling question (still deferred from earlier rounds).
- Any CDN/edge caching tuning for the new OG image routes beyond Next's defaults.
