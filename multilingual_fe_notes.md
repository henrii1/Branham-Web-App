# Multilingual Support — Frontend Notes

> **BLOCKED until Cloud Run deployment.** The API backend serving these changes has not yet been deployed. Do not wire up any of the below until the new image is live on Cloud Run and confirmed via `/api/health`. This note is here so the work is understood in advance.

---

## What changed on the API side

The backend (`/api/chat`) now natively supports three languages: **English, Spanish, and French**. When a request includes `user_language: "en" | "es" | "fr"`, the entire response — Answer, Quotes, References, Reader Note — comes back in that language. All other language codes result in a polite refusal in the user's detected language (the API handles that itself).

`user_language` is already in the proxy's `ChatRequestBody` type and passes through correctly. The proxy does not need to change.

---

## Language picker

Currently `SUPPORTED_LANGUAGES = ["en"]` and any non-English selection triggers `LanguageOnlyModal` with "English only (for now)."

Change `SUPPORTED_LANGUAGES` to `["en", "es", "fr"]`. Everything else stays unsupported and still gets the modal.

The three supported languages should appear visually separated (pinned to the top of the grid, or a distinct "Supported" section) so users find them without searching.

---

## Comprehensiveness tooltip for ES and FR

The corpora are separate and not equal in size:

| Language | Sermon count |
|---|---|
| English | 1,205 (complete corpus) |
| Spanish | 385 |
| French | 359 |

Spanish and French each have their own databases and indices containing native-language transcriptions of a subset of the English sermons. Queries in ES or FR search only the ES or FR corpus — they do not fall back into the English index.

The tooltip should make this clear so users know coverage is narrower than English.

Suggested wording when a user hovers over or selects Español / Français:

> "385 sermons are available in Spanish — a subset of the full English corpus of 1,205."

> "359 sermons are available in French — a subset of the full English corpus of 1,205."

Use whichever UI pattern fits — a tooltip on hover, a small info line below the button, or a one-liner inside the onboarding card.

---

## Anonymous banner — add "faster responses" to login prompt

For non-logged-in users, the API has to auto-detect the query language using `langid` before it can route correctly. This adds a small but real latency on every request (~100–200 ms). Logged-in users have their language preference stored on the profile and the API skips detection entirely.

Add "faster responses" as a reason to sign up in `AnonymousBanner.tsx`. Current copy:

> "Sign up to save your conversations and pick up right where you left off."

Suggested update:

> "Sign up for faster responses, saved conversations, and your preferred language."

Or a second line: "Logged-in users skip language detection for faster answers."

Keep it short — just make "faster" visible as a real benefit.

---

## Passing `user_language` to the API

Logged-in users: read the `language` column from the user's Supabase profile and pass it as `user_language` in the chat request body. Only pass `"en"`, `"es"`, or `"fr"` — if the stored value is anything else, omit the field and let the API detect.

Anonymous users: do not pass `user_language` at all. The API's `langid` detector handles it from the query text.

---

## What the API will do (no FE change needed)

- `user_language: "en"` → searches the English corpus (1,205 sermons), responds in English
- `user_language: "es"` → searches the Spanish corpus (385 sermons), responds fully in Spanish (Answer, Quotes, References, Reader Note)
- `user_language: "fr"` → searches the French corpus (359 sermons), responds fully in French
- field omitted → API detects language from query text; EN/ES/FR get native-corpus responses, anything else gets a polite decline in that language
- Any language code other than en/es/fr passed explicitly → treated as unsupported, API returns a translated refusal

The SSE event names, field names, and overall stream structure are unchanged, with one addition:

### New field on `final` — `language`

Every `final` event now includes a `language` field containing the ISO 639-1 code the API used to produce the response:

```json
{
  "mode": "answer",
  "answer": "...",
  "language": "es",
  "conversation_summary": "...",
  "query_summary": null,
  "external_info": null
}
```

Values are always one of `"en"`, `"es"`, or `"fr"`. Present on every outcome — answer, refusal, and error.

**Why this matters**: anonymous users don't have a stored language preference, so the API runs `langid` detection internally. The detected language is never sent back to the client anywhere else in the stream. Without this field, the frontend would have to run its own detection (or call `/api/reference` with the wrong corpus) to resolve citation pills for anonymous ES/FR users. Store `final.language` alongside the message and pass it as the `language` field in every subsequent `/api/reference` call for that message's citation pills.

---

## Citation tooltip endpoint — `POST /api/reference`

The reference endpoint (used to display clickable sermon citation pills as tooltips) now supports all three languages. **A `language` field must be added to every request.**

### What changed

Previously the endpoint always searched the English corpus regardless of what language the chat response was in. An ES or FR citation pill would either return 404 or silently return English paragraph text.

### New request field

```json
{
  "date_id": "53-0831",
  "paragraph_start": 10,
  "paragraph_end": 12,
  "language": "es"
}
```

`language` is optional and defaults to `"en"` on the API side, but it **must be passed** for ES/FR citations to resolve correctly. Unknown values fall back to English.

### Where to get the language value

The citation pills in the answer come from a response produced in a specific language. The language used for the chat request is the language to pass to `/api/reference`. Store it alongside the message — whatever `user_language` was sent (or detected) for that conversation turn is the value to pass here.

In practice: the `final` event already carries all of the citation pills in `final.answer`. The language that produced those pills is the same `user_language` that was sent with the original `/api/chat` request for that turn.

### Full multi-range example (ES)

```json
POST /api/reference
{
  "date_id": "53-0831",
  "title": "EL GRAN PASTOR",
  "language": "es",
  "ranges": [
    { "paragraph_start": 20, "paragraph_end": 25 },
    { "paragraph_start": 50, "paragraph_end": 55 }
  ]
}
```

Response shape is unchanged — `ok`, `date_id`, `title`, `groups[]` with `paragraphs[]` and `is_context` flags. No SSE, plain JSON.

### No change to EN behaviour

English citation pills work exactly as before. Passing `language: "en"` or omitting the field produces identical results.

---

## Addendum — "New languages" announcement

We want to surface a one-time announcement when users open the site explaining that Spanish and French are now supported, that we're continuing to improve the experience, and asking them to share the app with friends and acquaintances in those languages.

**Recommended pattern: one-time dismissible banner, not a timed popup.**

A 5-second auto-dismiss is risky — it's too short on mobile and many users will miss it entirely before it disappears. The standard approach is:

- Show a dismissible banner (top of the chat view, or a small toast in the corner).
- When the user clicks dismiss (or X), write a flag to `localStorage` (e.g. `branham_lang_announce_v1_dismissed = true`).
- On every subsequent page load, skip the banner if the flag is set.
- This means the banner shows exactly once per browser, stays until the user explicitly dismisses it, and never nags repeat visitors.

If the product preference is still a timed fade-out, 8–10 seconds is safer than 5 (especially for users who open the tab and switch away briefly). But the localStorage-dismiss pattern is the better UX.