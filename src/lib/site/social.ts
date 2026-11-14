/** Official BranhamSermons.ai pages, used by the site footer and the Family Altar call to action. */
export const CONTACT_EMAIL = "info@branhamsermons.ai";

export const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbE5R3qLI8YY3HEfmh0d";

export const SOCIAL_LINKS = {
  whatsapp: WHATSAPP_CHANNEL_URL,
  instagram: "https://www.instagram.com/branhamsermons.ai",
  facebook: "https://www.facebook.com/share/1A2ybQezGf/",
  tiktok: "https://www.tiktok.com/@branham.sermons.as",
  x: "https://x.com/branhamsermon",
} as const;

/** The YouTube channel by its id, which stays the same when the @handle is renamed. */
export const YOUTUBE_CHANNEL_ID = "UCz3k8Gyt9GLgGsOIP2JBPWg";
export const YOUTUBE_CHANNEL_URL = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`;
