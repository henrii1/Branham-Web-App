# Add to FAQ from the conversation sidebar — design

**Status:** implemented on `feature/add-to-faq` (2026-10-10); tested locally against a mock Model API

## Goal

Let the two admin accounts turn a single-turn conversation into a published FAQ entry (`/q/[slug]`, `/es/q/[slug]`, `/fr/q/[slug]`) from the conversation's three-dot menu, with all three languages generated, reviewed and published together.

## Decisions (from the owner)

- Admin-only: the two emails in `isAdminEmail()`. Hidden for everyone else; the server re-checks.
- Only conversations with exactly one question and one answer are eligible. For other conversations the menu item is shown disabled with the reason.
- All three answers are generated fresh from the question, including the conversation's own language, so every language has an answer and sermon passages produced together.
- Review before publishing. Nothing is written to `seo_cache` until the admin presses Publish.
- Duplicates are flagged as soon as the dialog opens, before anything is generated.

## Flow

1. **Admin opens "Add to FAQ"** on an eligible conversation. A dialog shows the conversation's question in an editable field. FAQs are always created from an **English** question for now: if the conversation wasn't in English, the admin rewrites the question in English in this field.
2. **Duplicate check, immediately** (on open, and again whenever the question is edited): the slug built from the question (same `slugify` rules as `scripts/seed-seo.ts`) already exists, or the same English question text is already published → warning + link to the existing page. While a duplicate is flagged, Generate is disabled.
3. **Prepare the question** — one call to the API's `POST /api/faq/translate`, which returns for en/es/fr: a well-formed public `question` and a fuller `robust_query` (the API repo's `core/prompts/FAQ_AND_FAMILY_ALTAR_API_CHANGES.md`, Task 1). The slug is rebuilt from the returned English `question` and checked for duplicates once more.
4. **Generate** — the browser calls the server once per language, one at a time (en, es, fr), showing progress. Each call sends that language's `robust_query` to `/api/chat` with `user_language` set. A failed language can be retried without redoing the others.
5. **Review** — the dialog shows, per language: the question (editable), the answer as it will render, and the passage count. Publish is enabled only when all three succeeded.
6. **Publish** — the server writes all three `seo_cache` rows in one request (`published: true`), then the admin gets links to the three pages.

## Server

`POST /api/admin/faq/check` — duplicate check (slug and English question text). Admin-gated.

`POST /api/admin/faq/prepare` — admin-gated proxy to the API's `/api/faq/translate`.

`POST /api/admin/faq/generate` — one language per call. Admin-gated. Calls `/api/chat` with `{ query: robust_query, user_language }`, reads the SSE stream to completion, and returns `{ answer_markdown, rag_context, conversation_summary, meta_title, meta_description }`. Processing matches `scripts/seed-seo.ts` (the more complete of the two seed scripts): `stripAnswerPrefix` → `postprocessChatResponse` for the answer, `postprocessRag` for passages, `query_summary`-based meta title, plain-text meta description.

`POST /api/admin/faq/publish` — admin-gated. Re-checks the slug isn't taken, inserts the three rows with the service-role client (the table only has a public read policy), then tries to clear the FAQ list cache.

Each row stores the API's `question` and `robust_query` for its language — the same two columns the original seed scripts filled by hand.

The admin check is `isAdminEmail()` on every route, as in `/api/admin/send-email`.

## API change (branham-llm-ai-api)

New `POST /api/faq/translate` endpoint, specified in the API repo at `src/branham_model_api/core/prompts/FAQ_AND_FAMILY_ALTAR_API_CHANGES.md` (Task 1). `/api/chat` itself is unchanged for FAQ generation. Ships in the same API release as the Family Altar devotional mode (Task 2 of that document).

## Editing and deleting (added 2026-10-10)

- Every `/q/[slug]`, `/es/q/[slug]`, `/fr/q/[slug]` page shows an **Edit** button to the two admin accounts. It edits that language's question and answer (with a live preview) via `POST /api/admin/faq/update`; the slug never changes, so links keep working.
- The Edit dialog has a **Delete FAQ** action. Deleting from any language removes every row with that slug (`POST /api/admin/faq/delete`), so the question can later be added again as a fresh three-language entry.
- Publish, update and delete all expire the FAQ list cache (`revalidateTag("faq-list", { expire: 0 })`); `sitemap.xml` is rendered per request so new entries reach it immediately.

## Known limits

- New entries are added to the end of the FAQ list (ordered by `created_at`).
- The FAQ list is cached for an hour. Publishing tries to clear that cache; if the Cloudflare setup can't share cache clears between instances, new entries appear within the hour. This is verified during implementation.
- Drafts live only in the open dialog; closing it before publishing discards them.
