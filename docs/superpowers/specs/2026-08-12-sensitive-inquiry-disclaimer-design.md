# Sensitive-inquiry disclaimer — design spec

Status: Approved
Date: 2026-08-12

## Problem

People are using the chat search to ask deeply personal, sensitive questions
(the kind that should go to a pastor, not an AI search tool). The tool's
answers are not reliable for that kind of question — it's built for
comparing sermon quotes/codes, finding exact references, and learning
general doctrine, not for personal spiritual counsel. We need to make that
boundary unmistakable in three places: the welcome email, a one-time
must-acknowledge modal, and a persistent reminder banner while chatting.

## Goals

- Tell every new user, in the welcome email, that the tool is for
  (1) comparing quotes/codes, (2) finding references, (3) general doctrine —
  and explicitly not for sensitive personal questions, which should go to
  their pastor instead.
- Block a first-time-this-session user from reaching the composer without
  acknowledging the same warning.
- Keep a persistent, non-dismissible reminder visible the entire time
  someone is in a chat.
- Cover both anonymous and logged-in users, since anonymous users can chat
  before ever signing up.
- Localize the modal/banner into en/es/fr, matching how the rest of the chat
  UI is already localized.

## Non-goals

- Not changing `/q/[slug]` SEO pages or `/share/[hash]` public share pages —
  neither has a live composer for a user to type a new sensitive question
  into.
- Not building account-level (server-persisted) acknowledgment tracking —
  session-scoped is sufficient per the approved design.
- Not adding hardcoded es/fr fallback constants in `welcomeTemplate.ts` —
  translated welcome-email content lives only in the DB (`intro_messages`),
  consistent with how translated FAQ content already works
  (`scripts/populate-faq-translations.ts`). The code fallback stays
  English-only and is only used if the DB read fails.

## Copy

### Modal (must click "I understand" — no backdrop/X dismiss)

| | en | es | fr |
|---|---|---|---|
| Heading | Before you begin | Antes de comenzar | Avant de commencer |
| Body | This tool is for comparing sermon quotes, finding exact references, and learning general doctrine — not for personal or sensitive spiritual questions. Its answers cannot be trusted for matters like that. If something sensitive or personal is on your heart, please ask your pastor instead. | Esta herramienta sirve para comparar citas de sermones, encontrar referencias exactas y aprender doctrina general — no para preguntas personales o espirituales sensibles. Sus respuestas no son confiables para ese tipo de asuntos. Si tienes algo sensible o personal en el corazón, por favor consulta a tu pastor. | Cet outil sert à comparer des citations de sermons, trouver des références exactes et apprendre la doctrine générale — pas à répondre à des questions personnelles ou spirituelles sensibles. Ses réponses ne sont pas fiables pour ce genre de sujets. Si vous portez quelque chose de sensible ou de personnel sur le cœur, veuillez consulter votre pasteur. |
| Button | I understand | Entendido | J'ai compris |

### Persistent banner (always-on, no dismiss, pinned under the header)

| en | es | fr |
|---|---|---|
| Not for personal or sensitive questions — ask your pastor. This tool is for comparing quotes, references, and general doctrine. | No es para preguntas personales o sensibles — consulta a tu pastor. Esta herramienta sirve para comparar citas, referencias y doctrina general. | Pas pour les questions personnelles ou sensibles — consultez votre pasteur. Cet outil sert à comparer des citations, des références et la doctrine générale. |

### Welcome email disclaimer paragraph

Inserted after the existing "After logging in, users can view past
conversations..." paragraph and before the closing "We sincerely
appreciate feedback..." paragraph, in all three language versions of the
letter.

**en:**
> **A note on how to use this tool:** Branham Sermons AI is built for three
> things — comparing sermon quotes, finding exact references, and learning
> general doctrine. It is not a substitute for your pastor, and the answers
> it gives cannot be trusted for personal or sensitive spiritual questions.
> If something like that is on your heart, please bring it to your pastor
> instead of this app.

**es:**
> **Una nota sobre cómo usar esta herramienta:** Branham Sermons AI está
> diseñada para tres cosas: comparar citas de sermones, encontrar
> referencias exactas y aprender doctrina general. No es un sustituto de tu
> pastor, y las respuestas que ofrece no son confiables para preguntas
> personales o espirituales sensibles. Si tienes algo así en el corazón,
> por favor llévalo a tu pastor en lugar de esta aplicación.

**fr:**
> **Une note sur l'utilisation de cet outil :** Branham Sermons AI est conçu
> pour trois choses : comparer des citations de sermons, trouver des
> références exactes et apprendre la doctrine générale. Il ne remplace pas
> votre pasteur, et les réponses qu'il fournit ne sont pas fiables pour des
> questions personnelles ou spirituelles sensibles. Si vous portez quelque
> chose de sensible ou de personnel sur le cœur, veuillez en parler à votre
> pasteur plutôt qu'à cette application.

### Full es/fr welcome-email letters

Since no Spanish or French `intro_messages` rows exist yet, this expands
scope to include full translations of the existing English letter (with the
disclaimer paragraph already folded in above), matching the personal,
first-person tone of the English original and the terminology conventions
already established in `scripts/populate-faq-translations.ts` ("Hermano
Branham" / "Frère Branham", "el Mensaje" / "le Message").

**es — subject:** `Nota de Lanzamiento — Branham Sermons AI`

> Nota de Lanzamiento — Branham Sermons AI
>
> Nos alegra presentarte Branham Sermons AI.
>
> La idea para esta aplicación surgió de una manera muy sencilla. Una
> mañana, durante la oración, vino a mi mente un sermón y quise buscarlo en
> la aplicación Table usando palabras clave. Probé cada palabra clave que
> se me ocurrió, pero aun así no pude encontrarlo. Fue entonces cuando vino
> el pensamiento: ¿y si existiera un sistema basado en IA donde las
> personas pudieran encontrar sermones, comparar doctrinas y conceptos, y
> estudiar el Mensaje y las Escrituras usando preguntas normales, como si
> contaran una historia, en lugar de solo palabras clave?
>
> A partir de ese momento, la carga creció hasta convertirse en algo más.
> En esta era de la IA, debería existir una herramienta que dé a las
> personas acceso más rápido a la información, especialmente a quienes aún
> no conocen al Hermano Branham, pero desean aprender sobre su vida, la
> obra de Dios en su ministerio y lo que él creía.
>
> Parte de esa carga también nació de una situación real. Hace un tiempo,
> mi hermano invitó a un amigo a la iglesia. Como el joven todavía vivía
> con sus padres, su padre buscó en internet para entender la iglesia y
> sus creencias. Lo que encontró fue material sobre temas como los Siete
> Truenos y los Sellos, y rápidamente concluyó que la iglesia era una
> secta. Entonces le aconsejó a su hijo que nunca asistiera. Eso me hizo
> sentir que, si una plataforma como esta hubiera existido, él habría
> podido buscar esas mismas preguntas y recibir un contexto más completo,
> más bíblico y mejor fundamentado.
>
> Esa es una de las principales razones por las que esta aplicación está
> diseñada especialmente tanto para personas fuera del Mensaje como para
> quienes ya están dentro de él. Ya sea que vengas de otra denominación, de
> otra religión, o simplemente sientas curiosidad por el Hermano Branham
> por primera vez, esta plataforma fue creada para ayudarte a buscar,
> entender y estudiar con más claridad. Si esta es tu primera vez
> conociendo al Hermano Branham, has llegado al lugar correcto.
>
> Branham Sermons AI incluye capacidades de búsqueda profunda que te
> ayudan a encontrar citas y sermones, ya sea por las palabras exactas o
> describiendo el contexto con tus propias palabras. Los resultados de la
> búsqueda aparecen en la ventana de Fuentes, mientras que la IA ofrece una
> respuesta más clara y enfocada en el chat. La aplicación también incluye
> una sección de Preguntas Populares con muchas de las preguntas
> doctrinales que la gente suele hacer sobre el Hermano Branham.
>
> Cada respuesta incluye referencias explícitas de sermones para que los
> usuarios puedan localizar fácilmente las citas originales y leer el
> sermón completo en la aplicación Table.
>
> Después de iniciar sesión, los usuarios pueden ver conversaciones
> pasadas y continuar sus estudios desde donde los dejaron.
>
> Una nota sobre cómo usar esta herramienta: Branham Sermons AI está
> diseñada para tres cosas: comparar citas de sermones, encontrar
> referencias exactas y aprender doctrina general. No es un sustituto de
> tu pastor, y las respuestas que ofrece no son confiables para preguntas
> personales o espirituales sensibles. Si tienes algo así en el corazón,
> por favor llévalo a tu pastor en lugar de esta aplicación.
>
> Agradecemos sinceramente los comentarios y recomendaciones, tanto de
> quienes son nuevos en el Mensaje como de aquellos a quienes Dios ha
> ayudado ya a estudiar muchos de los sermones. Puedes contactarnos en
> info@branhamsermons.ai.
>
> Administración
> Branham Sermons AI

**fr — subject:** `Note de Version — Branham Sermons AI`

> Note de Version — Branham Sermons AI
>
> Nous sommes heureux de vous présenter Branham Sermons AI.
>
> L'idée de cette application est née de manière très simple. Un matin,
> pendant la prière, un sermon m'est venu à l'esprit et j'ai voulu le
> rechercher dans l'application Table à l'aide de mots-clés. J'ai essayé
> toutes les idées de mots-clés possibles, mais je n'arrivais toujours pas
> à le trouver. C'est alors qu'est venue la pensée : et s'il existait un
> système basé sur l'IA où les gens pourraient trouver des sermons,
> comparer des doctrines et des concepts, et étudier le Message et les
> Écritures en posant des questions normales, comme un récit, plutôt qu'en
> utilisant seulement des mots-clés ?
>
> À partir de là, ce fardeau est devenu quelque chose de plus grand. En
> cette ère de l'IA, il devrait exister un outil qui donne aux gens un
> accès plus rapide à l'information, en particulier à ceux qui ne
> connaissent pas encore le Frère Branham, mais qui souhaitent en
> apprendre davantage sur sa vie, l'œuvre de Dieu dans son ministère et ce
> qu'il croyait.
>
> Une partie de ce fardeau est aussi née d'une situation réelle. Il y a
> quelque temps, mon frère a invité un ami à l'église. Comme ce jeune
> homme vivait encore chez ses parents, son père a fait des recherches en
> ligne pour comprendre l'église et ses croyances. Ce qu'il a trouvé,
> c'était des documents sur des sujets comme les Sept Tonnerres et les
> Sceaux, et il en a rapidement conclu que l'église était une secte. Il a
> alors conseillé à son fils de ne plus jamais y assister. Cela m'a fait
> sentir que si une plateforme comme celle-ci avait existé, il aurait pu
> rechercher ces mêmes questions et recevoir un contexte plus complet,
> plus scripturaire et mieux fondé.
>
> C'est l'une des principales raisons pour lesquelles cette application
> est spécialement conçue autant pour les personnes en dehors du Message
> que pour celles qui en font déjà partie. Que vous veniez d'une autre
> dénomination, d'une autre religion, ou que vous soyez simplement curieux
> de découvrir le Frère Branham pour la première fois, cette plateforme a
> été conçue pour vous aider à rechercher, comprendre et étudier plus
> clairement. Si c'est la première fois que vous vous intéressez au Frère
> Branham, vous êtes au bon endroit.
>
> Branham Sermons AI dispose de capacités de recherche approfondies qui
> vous aident à trouver des citations et des sermons, que ce soit par les
> mots exacts ou en décrivant le contexte avec vos propres mots. Les
> résultats de recherche apparaissent dans la fenêtre Sources, tandis que
> l'IA fournit une réponse plus claire et plus ciblée dans le chat.
> L'application comprend également une section Questions Populaires
> regroupant de nombreuses questions doctrinales fréquemment posées au
> sujet du Frère Branham.
>
> Chaque réponse comprend des références explicites de sermons afin que
> les utilisateurs puissent facilement localiser les citations originales
> et lire le sermon complet dans l'application Table.
>
> Après s'être connectés, les utilisateurs peuvent consulter leurs
> conversations passées et poursuivre leurs études là où ils les avaient
> laissées.
>
> Une note sur l'utilisation de cet outil : Branham Sermons AI est conçu
> pour trois choses : comparer des citations de sermons, trouver des
> références exactes et apprendre la doctrine générale. Il ne remplace pas
> votre pasteur, et les réponses qu'il fournit ne sont pas fiables pour des
> questions personnelles ou spirituelles sensibles. Si vous portez quelque
> chose de sensible ou de personnel sur le cœur, veuillez en parler à
> votre pasteur plutôt qu'à cette application.
>
> Nous apprécions sincèrement les retours et recommandations, tant de la
> part de ceux qui découvrent le Message que de ceux que Dieu a déjà
> aidés à étudier plusieurs sermons. Vous pouvez nous contacter à
> info@branhamsermons.ai.
>
> Administration
> Branham Sermons AI

## Architecture

### `SensitiveUseModal.tsx` (new)

Same shell/layout pattern as `LangFeatureModal.tsx` (backdrop + bottom-sheet
on mobile / centered card on sm+), with two deliberate differences:

- No backdrop-click close, no X button — the only way to dismiss it is the
  "I understand" button. This matters because the whole point is confirming
  the warning was actually seen.
- Gated by `sessionStorage` (key `branham_sensitive_disclaimer_ack_v1`), not
  `localStorage` — reappears on a fresh browser session, stays quiet for
  the rest of that session across any number of new/continued
  conversations.

Takes `language` as a prop (same as `ShareFeatureBanner`) and reads copy via
new `getChatStrings()` keys.

### `SensitiveUseBanner.tsx` (new)

Same visual language as `ShareFeatureBanner.tsx` (slim strip, icon + text,
`border-b`) but:

- No dismiss button — always rendered for as long as `ChatShell` is
  mounted.
- No `localStorage`/dismissed state at all.

### Wiring into `ChatShell`

Both render unconditionally near the top of the chat surface (modal as an
overlay, banner inline under the header, above `MessageList`), for both
anonymous and logged-in users, on `/chat` and `/chat/[conversationId]`.
Neither is added to `SeoShell.tsx` or `SharePageShell.tsx`.

### `chatStrings.ts` additions (en/es/fr)

New keys: `sensitiveModalHeading`, `sensitiveModalBody`,
`sensitiveModalAck`, `sensitiveBannerText`.

## Data model

New migration `009_add_sensitive_use_disclaimer.sql`:

1. `UPDATE public.intro_messages SET body_markdown = '<en letter with
   disclaimer folded in>' WHERE language = 'en' AND subject = 'Release Note
   Branham Sermons AI';`
2. `INSERT INTO public.intro_messages (language, subject, body_markdown)`
   for `es` and `fr`, each guarded by the same
   `where not exists (select 1 from public.intro_messages where language =
   '<lang>')` idempotency pattern `002_seed_intro_messages.sql` already
   uses.

`src/lib/email/welcomeTemplate.ts`'s `FALLBACK_WELCOME_EMAIL_TEMPLATE`
(English only) gets the same disclaimer paragraph appended, so the
code-path fallback stays in sync with the DB row's content if the DB read
ever fails.

`src/app/api/welcome-email/route.ts` needs no changes — it already reads
`intro_messages` filtered to `[preferredLanguage, "en"]` and falls back to
English, so the new es/fr rows are picked up automatically once a user's
`profiles.language` is `es`/`fr`.

## Testing plan

- Unit-level: none of this introduces new business logic beyond a
  sessionStorage flag check, so manual verification is sufficient.
- Manual, per language (en/es/fr), each via the language switcher / profile
  language setting:
  - Fresh browser session on `/chat`: modal blocks the composer, backdrop
    click and Escape do nothing, only "I understand" dismisses it.
  - After dismissing, start a second new conversation in the same session
    — modal does not reappear; banner stays visible under the header the
    whole time.
  - New browser session (or `sessionStorage.clear()`): modal reappears.
  - Anonymous (logged-out) user on `/chat`: same modal/banner behavior,
    unaffected by auth state.
  - `/q/[slug]` and `/share/[hash]`: unchanged, no modal/banner.
  - Trigger `/api/welcome-email` for a fresh signup in each of en/es/fr and
    confirm the correct localized letter (with disclaimer) is sent.