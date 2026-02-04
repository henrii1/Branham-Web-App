# Branham Web App — Design Guide (Next.js App Router + Supabase)

Project: **Branham Web App**

Purpose: A minimal, high-performance ChatGPT-style web app that manages:
- Auth and user sessions (**Supabase Auth**)
- Chat session/history persistence (**Supabase DB**) for **logged-in users only**
- Rendering model responses as **streamed Markdown**
- Making exactly **one downstream API call per user message** to the **Branham Model API** (Python service)

v1 UX: **No reader view**, **no references panel/list**. References are rendered **inline** (Markdown links or plain `[date_id: ¶x–¶y]` tokens).

---

## 0) Non-negotiables (LOCKED)

- Use **Next.js best practices** to minimize latency and avoid common perf pitfalls.
- Keep UI simple: chat window + history sidebar (ChatGPT-like).
- Supabase client is responsible for:
  - authentication (sign-in/sign-out/session)
  - chat history CRUD (**logged-in users only**)
- No caching in v1 (no response caching, no embedding caching).
- The web app makes **only one API call per user message**:
  - `POST /chat` to the Branham Model API (via Next route handler `POST /api/chat`)
- Everything else is local UI work: streaming render, markdown sanitize, reference formatting.

Free app v1 constraints:
- No API key management in v1.
- Support anonymous usage:
  - user can chat
  - **no persistence**
  - **memory-only** (refresh loses all history)
- SEO (v1):
  - **English-only** for SEO pages
  - curated FAQ cache pages (no duplicates per query/intent)

---

## 1) Performance principles (Next.js-specific)

Next.js can feel slower than direct React if misused. Follow these rules:

- Prefer **Server Components by default** (App Router), but keep the interactive chat surface as **Client Components**:
  - chat input
  - streaming assistant message area
  - message list container
- Avoid heavy client-side bundles:
  - keep dependencies minimal
  - do not import large libraries into client components
  - dynamic import for non-critical widgets
- Use **streaming UI**:
  - stream Model API response via `/api/chat` route handler to the frontend
  - update assistant content progressively
- Use stable rendering patterns:
  - avoid re-rendering the whole message list for each token
  - append streamed content to the “currently streaming assistant message” efficiently
- Keep DB round-trips minimal:
  - fetch conversations list in one query
  - fetch conversation messages in one query
  - if metadata resolution is needed, batch it (no per-reference query loops)

---

## 2) App behavior overview

### 2.1 User story (anonymous + logged-in)

1. User opens app.
2. Anonymous mode (default when not logged in):
   - user can send messages and get answers
   - conversation exists **only in runtime memory**
   - refresh/tab close → **history is lost**
3. After the first completed assistant response in anonymous mode:
   - show a nudge banner: “Log in to preserve your history.”
4. If user signs up:
   - immediately after account creation, user selects preferred language
   - profile is created/updated with language
   - user sees a welcome page with a language-specific intro message
   - welcome email is sent **once** (signup-only)
   - user clicks “Continue” → chat UI
5. If user is logged in:
   - new conversations and messages are persisted
   - history sidebar is available and persistent
6. User sends a message.
7. Web backend sends exactly one request to Model API:
   - `POST /chat`
8. UI streams and renders the response (Markdown).
9. References appear **inline** in the assistant response:
   - either as Markdown links
   - or as plain tokens like `[47-0412--M: ¶2–¶3]`
10. Logged-in users: messages saved after stream completes.

---

## 3) Data modeling and persistence (Supabase)

### 3.1 Relationships (LOCKED)
- `conversations` has a **one-to-many** relationship with `chat_messages`.
- History sidebar (logged-in only) is built by querying conversations:
  - title
  - updated_at ordering
- Chat view is built by querying messages for a selected conversation:
  - `SELECT * FROM chat_messages WHERE conversation_id = ... ORDER BY created_at ASC`

### 3.2 Anonymous mode rules (LOCKED)
- Anonymous user has:
  - no `user_id`
  - no DB persistence
- In anonymous mode:
  - conversation exists only in runtime memory
  - a local `conversation_id` may be generated for UI grouping, but is never persisted
- On login:
  - new chats and messages are persisted going forward
  - optional future UX (“Save this chat”) is out of scope for v1

---

## 4) References in responses (UPDATED — no panel/list)

Model returns references inline in answer text, e.g.:
- `[47-0412--M: ¶2–¶3]`

v1 rendering requirements:
- References are shown **inline only** (no expandable references panel/list).
- The UI may optionally convert recognized reference tokens into Markdown links (e.g., to a future reader route), but v1 does not require a reader page.
- The UI may optionally resolve `date_id → sermon title` to show a friendlier hover/tooltip (optional), but the core requirement is inline display.

### 4.1 Parsing rules (tolerant)
- Pattern conceptually:
  - `[` + `date_id` + `:` + paragraph range + `]`
- Extract:
  - `date_id` = `yy-mmdd--M|E` or your canonical format
  - `paragraph_start`, `paragraph_end`
- Be tolerant:
  - `¶2–¶3` or `¶2-¶3`
  - allow spaces

### 4.2 sermon_metadata usage (optional in v1)
- `sermon_metadata` maps:
  - `date_id -> title, preacher, language(optional)`
- If used:
  - batch resolve all `date_id`s found in the message in one query
  - apply optional enhancements (tooltip/link label)
- v1 does **not** require storing `references_json`; parsing can happen at render time.

---

## 5) Supabase responsibilities (v1)

Supabase client handles:
- Auth
- Session state
- Chat persistence for logged-in users
- Profile persistence (language, basic user info)

No caching in v1 for chat responses.

---

## 6) Required database tables (minimum)

### 6.1 conversations
- id (uuid, PK)  ← conversation_id
- user_id (uuid, nullable; v1 persisted conversations require user_id)
- title (text, optional auto-title)
- created_at
- updated_at

Notes:
- Logged-in conversations: `user_id` required.
- Anonymous conversations are not persisted in v1.

### 6.2 chat_messages
- id (uuid, PK)
- conversation_id (uuid, FK -> conversations.id)
- user_id (uuid, nullable; v1 persisted messages require user_id)
- role (`user` | `assistant`)
- content (text)  ← stored as Markdown for assistant messages
- created_at

Notes:
- Persist assistant message only after stream completion.
- No partial message rows in v1.

### 6.3 profiles
- user_id (uuid, PK, FK -> auth.users)
- display_name (text, optional)
- language (text, required; editable in profile)
- welcome_email_sent_at (timestamptz, nullable)  ← send-once guard
- created_at
- updated_at

Notes:
- language is selected immediately after signup completion.

### 6.4 intro_messages
- id (uuid, PK)
- language (text)
- subject (text)
- body_markdown (text)
- created_at
- updated_at

Notes:
- Used to display welcome text and generate welcome email content by language.

### 6.5 sermon_metadata
- date_id (text, PK)
- title (text)
- preacher (text, default “William Marrion Branham”)
- language (text, default “en”)
- created_at

Notes:
- Pre-seeded from corpus pipeline.
- Optional for v1 inline enhancements.

### 6.6 faq_cache (SEO)
- slug (text, PK)
- question (text)
- answer_markdown (text)
- language (text, default “en”)  ← v1 SEO targets English only
- published (boolean, default false)
- meta_title (text, optional)
- meta_description (text, optional)
- updated_at
- created_at

Notes:
- Manually curated content only (no on-the-fly API calls).
- Only `published=true` pages are indexable.

---

## 7) API call contract (web app side)

### 7.1 Single downstream call per user message (LOCKED)
The web backend calls the Model API:

- `POST {MODEL_API_BASE_URL}/chat`

Request:
- conversation_id (string/uuid)
- user_language
- query
- optional:
  - history_window (deterministic truncation)
  - conversation_summary (v1: **not used**)

Important v1 rule:
- **No conversation summarization** in v1.
- Use truncation instead:
  - send only the last N messages or last X tokens as `history_window`
  - deterministic and fast

Response (streaming):
- streamed markdown answer text (primary)
- optional final metadata frame/event (if supported by your API)
  - e.g., mode, citations, debug flags
- In v1, the UI does not require a separate references payload.

### 7.2 Web backend route (ONLY model call path)
Implement a single Next.js route handler:
- `POST /api/chat`

Responsibilities:
- Determine if user is logged in (Supabase session):
  - if logged in: persist conversation + messages
  - if anonymous: do not persist
- Persist user message (logged-in only)
- Call Model API (streaming)
- Stream response to client
- Persist final assistant message (logged-in only) **after stream ends**

Constraints:
- Exactly one downstream Model API call per user message.
- Never expose Model API keys to the client.

---

## 8) UI requirements (ChatGPT-like)

### 8.1 Layout
- Left sidebar (~1/5 width):
  - list of conversations (history) (logged-in only)
  - create new chat button
  - sign in / sign out button
- Main panel:
  - messages list
  - message input box
  - streaming assistant response rendered as Markdown

Anonymous UX:
- Sidebar hidden or disabled
- Show “Sign in to save history” banner (nudge after first exchange)

### 8.2 Behavior
- Logged-in:
  - New chat creates a `conversations` row
  - Sending message creates a `chat_messages` row for user
  - Assistant message saved at end of stream (markdown text)
- Anonymous:
  - New chat is memory-only
  - Sending message updates local state only
  - Assistant message stored in local state only

### 8.3 Accessibility
- Keyboard navigation for conversations list
- Enter to send, Shift+Enter for newline
- Good contrast and readable typography

---

## 9) Streaming Markdown rendering rules (LOCKED)

- The Model API streams Markdown.
- Client rendering strategy:
  - append streamed text to a buffer
  - only re-render Markdown at safe boundaries:
    - preferred: paragraph boundary (`\n\n`)
    - acceptable: newline (`\n`)
  - on stream completion:
    - do one final full Markdown render

Goal:
- avoid re-rendering the whole message list per token
- minimize layout jitter

---

## 10) Markdown sanitization (LOCKED)

Even if the model outputs “strict Markdown,” the renderer must be safe.

Sanitization policy:
- Allow a safe Markdown subset:
  - paragraphs, emphasis, lists, blockquotes, links
- Disallow raw HTML and any HTML passthrough
- Links:
  - allow only `http://` and `https://`
  - add `rel="noopener noreferrer"` and `target="_blank"` for external links
- Never execute scripts or unsafe URLs.

---

## 11) Signup, language selection, welcome page, and welcome email (NEW)

### 11.1 Signup providers
- Support:
  - Google OAuth
  - Email login (Supabase Auth OTP/magic-link style)

### 11.2 Language selection (required)
- Immediately after account creation:
  - user selects preferred language
  - store it in `profiles.language`
- Language is editable later on profile page.

### 11.3 Welcome page
- After language selection:
  - show a welcome message pulled from `intro_messages` where `language = profiles.language`
  - include a “Continue” button → chat UI
- Welcome message should include an instruction similar to:
  - “Welcome, {name}. This app helps you find what Brother Branham said. For deeper study and context, use The Table app.”

### 11.4 Welcome email (signup-only, send-once)
- On signup completion (not on every login):
  - send a welcome email using the language-specific intro content
- Prevent duplicates:
  - only send if `profiles.welcome_email_sent_at IS NULL`
  - set timestamp after success

Email implementation:
- v1 default: Nodemailer via SMTP from the Next.js backend (Node runtime)
- delivery fallback: swap provider (e.g., Postmark) behind a single `sendWelcomeEmail()` interface

---

## 12) SEO and FAQ cache (UPDATED)

Goal:
- Rank for curated English questions about Branham sermons by serving stable, indexable pages.

### 12.1 Cache rules
- FAQ cache is **manual curated**
- No on-the-fly Model API call for SEO page rendering
- Each cached question has exactly one canonical route (no duplicates)

### 12.2 Routing
- Public SEO route:
  - `/q/[slug]`
- Loads `faq_cache` by slug.
- Renders cached answer into the same chat-style UI (seeded conversation look).

Follow-up behavior:
- Logged-in:
  - create a new `conversations` row (user_id set)
  - insert cached content as the first assistant message
  - then user follow-up becomes next message and triggers `/api/chat`
- Anonymous:
  - memory-only seeded conversation
  - refresh loses it

### 12.3 Indexing controls (LOCKED)
- Only allow indexing for `faq_cache.published=true` pages.
- All chat pages and user conversation routes are **noindex**.
- Unpublished slugs:
  - return 404 or `noindex` response (choose one policy and apply consistently)

---

## 13) Security and rate limiting (v1 minimal)

- Validate Supabase session for persistence actions.
- Anonymous `/api/chat` requests are allowed but rate-limited (simple server-side limit).
- No API key management in v1.
- Never expose Model API keys to the client.
- Store minimal PII.

---

## 14) Row Level Security (RLS) requirements (LOCKED)

Implement Supabase RLS so users can only access their own data.

- conversations:
  - logged-in user can read/write only where `user_id = auth.uid()`
- chat_messages:
  - logged-in user can read/write only messages belonging to their conversations
  - enforce via `user_id = auth.uid()` or via join on conversations.user_id = auth.uid()
- profiles:
  - logged-in user can read/write only where `profiles.user_id = auth.uid()`
- sermon_metadata:
  - public read (SELECT allowed)
- faq_cache:
  - public read only where `published = true`

---

## 15) Next.js codebase structure (recommended scaffold)

web-app/
- README.md
- next.config.js
- .env.local
- src/
  - app/
    - layout.tsx
    - page.tsx
    - (auth)/
      - login/page.tsx
      - signup/page.tsx
      - onboarding/
        - language/page.tsx
        - welcome/page.tsx
      - profile/page.tsx
    - (app)/
      - chat/page.tsx
      - chat/[conversationId]/page.tsx
      - q/[slug]/page.tsx
    - api/
      - chat/route.ts              # ONLY model call path
      - welcome-email/route.ts     # sends welcome email (signup-only)
  - components/
    - chat/
      - ChatShell.tsx
      - MessageList.tsx
      - MessageBubble.tsx
      - Composer.tsx
      - ConversationSidebar.tsx
      - AnonymousBanner.tsx
    - auth/
      - AuthGate.tsx
      - LanguagePicker.tsx
  - lib/
    - supabase/
      - client.ts
      - server.ts
      - middleware.ts
    - modelApi/
      - client.ts                  # fetch/stream wrapper
    - markdown/
      - render.ts                   # markdown render + sanitize
      - sanitize.ts
    - references/
      - parse.ts                    # parse [date_id: ¶x–¶y] tokens
      - optionalEnhance.ts          # optional: tooltips/labels
    - db/
      - queries.ts                  # typed DB access helpers
    - email/
      - sendWelcomeEmail.ts         # provider abstraction (Nodemailer/Postmark)
    - utils/
      - ids.ts
      - time.ts
  - styles/
    - globals.css

---

## 16) Implementation stages (ADD IF NOT PRESENT)

### Stage 1 — Skeleton + Auth
- Next.js app scaffold (App Router)
- Supabase client/server setup
- Login page (Google OAuth + email login)
- Signup → onboarding language selection
- Profiles table integration
- Welcome page renders intro message by language

### Stage 2 — Core Chat (Anonymous + Logged-in)
- Chat UI (messages + composer)
- Anonymous memory-only chat
- Nudge banner after first exchange
- Logged-in conversation creation + message persistence
- Conversations sidebar for logged-in users

### Stage 3 — Streaming `/api/chat` integration
- Implement `/api/chat` streaming proxy to Model API
- Client-side streaming buffer + safe-boundary markdown rendering
- Final markdown render on completion
- Persist assistant message only when stream completes (logged-in)

### Stage 4 — Markdown sanitization hardening
- Lock allowed markdown subset
- Disable raw HTML
- Link safety rules

### Stage 5 — SEO FAQ cache
- `faq_cache` table
- `/q/[slug]` SSR page rendering cached answer (English-only)
- Noindex rules for non-SEO pages
- Published-only indexing

### Stage 6 — Welcome email (signup-only)
- `profiles.welcome_email_sent_at`
- `sendWelcomeEmail()` provider abstraction
- `/api/welcome-email` route (Node runtime)
- SMTP (Nodemailer) in v1; switchable to Postmark later

### Stage 7 — RLS + rate limiting
- Supabase RLS policies enforced
- Anonymous rate limiting on `/api/chat`

---

## 17) Out of scope for v1 (LOCKED)

- Full sermon reader view (deep linking into text)
- Caching layer for chat responses
- Offline support
- Advanced analytics dashboards
- Multi-tenant admin console
- Auto-generation of SEO pages (v1 is curated only)

