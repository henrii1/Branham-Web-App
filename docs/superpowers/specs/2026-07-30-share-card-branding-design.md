# Share Card Branding Line

**Date:** 2026-07-30
**Status:** Approved

## Problem

The share card carries a "Read more →" link back to the specific conversation/answer it was generated from, but nothing on the card identifies *the app itself* — someone who receives the card via WhatsApp/Instagram with no other context has no way to know it came from Branham Sermons Assistant or find the site directly.

## Goal

Add a small, quiet brand line to the bottom of every generated card, below the existing "Read more →" line, pointing to the app's homepage.

## Non-Goals

- No functional hyperlink. The card is a static rasterized PNG (`html-to-image`) — nothing on it is actually clickable, including the existing "Read more →" line today. Both lines are visual only; a viewer reads/types the URL themselves.
- No new component props, no new `chatStrings.ts` keys. Both the homepage URL and "Branham Sermons Assistant" are fixed, non-localized constants — matching existing precedent (the brand name isn't translated anywhere else in the app; see the native-share feature's `title` field for the same reasoning).
- No change to card dimensions, dynamic font-sizing tiers, or any other existing card element.

## Design

### Content

A new line, directly below the existing "Read more →" line, on both `landscape` and `portrait` formats:

```
Branham Sermons Assistant → https://branhamsermons.ai
```

Full URL with `https://`, matching exactly how "Read more →" already displays the share URL — visual consistency between the two lines, not a bare domain.

### Placement

Last element on the card, after "Read more →". The two lines sit close together (a small, fixed gap distinct from the larger `gap` value used between the card's main sections — question / excerpt / dots / this footer block) so they read as one small footer unit, not two separately-spaced calls-to-action.

### Styling — "quiet, like a logo"

Same blue (`textShade.linkColor`) and `Geist Mono` font family as "Read more →", so the two lines are clearly related, but:
- **Smaller:** 11px, versus "Read more"'s fixed 15px.
- **Reduced opacity:** ~75%, so it reads as present-but-secondary rather than a second competing call-to-action.

Both values are fixed regardless of the card's dynamic content-length sizing tier (`getLandscapeSizing`/`getPortraitSizing` in `ShareCardTemplate.tsx`) — "Read more" is already fixed-size for the same reason (a footer element shouldn't grow/shrink with the excerpt's length), and this new line follows the same rule.

## Implementation sketch

Everything changes inside `src/components/chat/ShareCardTemplate.tsx`, in the same block that currently renders the "Read more" line — wrap both in a small flex column so the tight-gap stacking is explicit rather than relying on the parent's larger `gap`:

```tsx
<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
  <div
    style={{
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      fontSize: 15,
      fontWeight: 600,
      color: textShade.linkColor,
    }}
  >
    {readMoreLabel} → {readMoreUrl}
  </div>
  <div
    style={{
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      fontSize: 11,
      fontWeight: 600,
      color: textShade.linkColor,
      opacity: 0.75,
    }}
  >
    Branham Sermons Assistant → https://branhamsermons.ai
  </div>
</div>
```

This wrapping `<div>` replaces the current bare "Read more" `<div>` as the last child of the card's content flex column — no other element changes.

## Testing / verification approach

Purely visual — no new logic, no new data flow, nothing that can fail at runtime beyond a typo. Verify via the same Playwright-driven visual check used for every prior card-template change this project: render both formats (`landscape`/`portrait`), both text shades (dark/light), across a short and a long excerpt sample, and confirm the new line is legible, correctly positioned, and doesn't cause overflow at any content-length tier (the existing overflow-fix work already established the card's worst-case content budget; this line is a small fixed addition on top of that, not expected to change the outcome, but should be re-confirmed rather than assumed).

## Out of Scope / Deferred

- The Facebook/WhatsApp format-toggle relabeling question (still deferred from earlier).
