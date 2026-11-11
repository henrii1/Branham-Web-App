# Links page

The social media bios link to our own links page instead of Linktree:

- English: https://branhamsermons.ai/links
- Spanish: https://branhamsermons.ai/es/links
- French: https://branhamsermons.ai/fr/links

It is built into the site (`src/components/site/LinksPage.tsx`, text in `src/lib/site/links.ts`): the WhatsApp channel first, today's Family Altar verse, then the nature series, Bible search, Bible questions and Sermon search, then the social icons. Social URLs come from `src/lib/site/social.ts`.

## Direct links

| Feature | Link |
|---|---|
| Christianity Seen in Nature | https://branhamsermons.ai/faq/nature |
| Ask the Bible (Bible search) | https://branhamsermons.ai/chat?mode=bible |
| Bible questions | https://branhamsermons.ai/faq#bible-questions |
| Ask the Sermons (Sermon search) | https://branhamsermons.ai/chat?mode=sermons |
| Family Altar | https://branhamsermons.ai/altar |
| About | https://branhamsermons.ai/about |

Spanish and French pages add `/es` or `/fr` before the path (not the chat links, which have no language address). The chat links open a new chat in that mode; a visitor who hasn't chosen a mode yet isn't asked, and the link's mode becomes their default in that browser.

## Socials

| Title | Link |
|---|---|
| WhatsApp channel | https://whatsapp.com/channel/0029VbE5R3qLI8YY3HEfmh0d |
| Instagram | https://www.instagram.com/branhamsermons.ai |
| Facebook | https://www.facebook.com/share/1A2ybQezGf/ |
| TikTok | https://www.tiktok.com/@branham.sermons.as |
| X | https://x.com/branhamsermon |
| Email | mailto:info@branhamsermons.ai |
