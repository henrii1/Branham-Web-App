# Share Card Corner Brand Mark

**Date:** 2026-07-30
**Status:** Approved (supersedes `2026-07-30-share-card-branding-design.md`)

## Problem

The small quiet footer line shipped in the prior branding round didn't land: wrong placement (stacked directly under "Read more →" rather than its own element) and wrong weight ("quiet, like a logo" was meant as *prominent*, matching the app's real header logo treatment, not small/muted text).

## Goal

Replace the footer line with a bottom-left corner brand mark: the app's icon image (`logo.png`) paired with the "Branham Sermons Assistant" name, sized and styled like the app's own header lockup (`BrandLogo.tsx`).

## Non-Goals

- No functional hyperlink. Confirmed impossible for the same reason as the prior round: the card is a static rasterized PNG, nothing in it is clickable in any viewer, regardless of format.
- No visible URL text next to the name — plain name only, per explicit user instruction ("not a link, just a name").
- No new `chatStrings.ts` keys — the brand name is a fixed, non-localized constant, same precedent as before.

## Design

### Placement

Bottom-left corner of the card, absolutely positioned as a sibling of the centered content column (not part of the flex-centered stack), at the card's existing `paddingX`/`paddingY` inset so it aligns with the content block's own margins.

### Content

Icon image (`/logo.png`, plain `<img>` against the public static path rather than `next/image`'s optimization proxy — `html-to-image` rasterizes the live DOM, and a stable, directly-fetchable URL avoids any risk of the logo being blank in the exported PNG because an optimization request hadn't resolved yet) + "Branham Sermons Assistant" in `Newsreader` (the app's `.font-display` face), `font-weight: 600`, using `textShade.textColor` — not `linkColor` — since this is a logo, not a link.

Sizing: `brandMarkIconSize` 32px landscape / 40px portrait; `brandMarkTextSize` 16px landscape / 20px portrait — scaled up for portrait to match the rest of the card's type, same pattern the dynamic content-sizing tiers already follow.

### Why the icon reuses the same mark as the tiled background

`logo.png` is also the source of the faint repeating background pattern already on every card. Confirmed via direct visual verification (not assumed) that this reads as distinct in practice: the corner mark is full-opacity and much larger than any single tile in the pattern, so it doesn't get lost or read as a duplicate.

## Testing / verification approach

Same as prior rounds — visual, via Playwright: live-DOM screenshots across format (landscape/portrait) × background (light/dark) × content length (short/long), confirming no overlap with the main content block. Additionally, this round verified the actual **rasterized** `html-to-image` output specifically (not just the live DOM) — the real risk flagged in the code comment above — by driving `toPng()` directly and inspecting the resulting PNG, confirming the icon loads correctly rather than rendering blank.

## Out of Scope / Deferred

- The Facebook/WhatsApp format-toggle relabeling question (still deferred from earlier rounds).
