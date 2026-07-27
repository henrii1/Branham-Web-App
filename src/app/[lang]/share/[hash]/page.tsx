import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchShareByHash, fetchSharedMessages } from "@/lib/db/share-queries";
import { createClient } from "@/lib/supabase/server";
import { SharePageShell } from "@/components/share/SharePageShell";
import { getChatStrings } from "@/lib/i18n/chatStrings";
import type { Message } from "@/lib/chat/types";

const SITE_URL = "https://branhamsermons.ai";
const SUPPORTED_LANGS = ["es", "fr"] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; hash: string }>;
}): Promise<Metadata> {
  const { lang, hash } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) return { title: "Not Found" };
  const share = await fetchShareByHash(hash);
  if (!share || share.language !== lang) return { title: "Not Found" };
  const title = `${share.title_snapshot ?? "Shared conversation"} | Branham Sermons Assistant`;
  return {
    title: { absolute: title },
    alternates: { canonical: `${SITE_URL}/${lang}/share/${hash}` },
  };
}

export default async function LocalizedSharePage({
  params,
}: {
  params: Promise<{ lang: string; hash: string }>;
}) {
  const { lang, hash } = await params;
  if (!SUPPORTED_LANGS.includes(lang as SupportedLang)) notFound();

  const share = await fetchShareByHash(hash);
  if (!share || share.language !== lang) notFound();

  const messageRows = await fetchSharedMessages(hash);
  if (messageRows.length === 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === share.owner_id;

  const messages: Message[] = messageRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <SharePageShell
      conversationId={share.conversation_id}
      shareHash={hash}
      title={share.title_snapshot}
      messages={messages}
      isOwner={isOwner}
      language={lang}
      strings={getChatStrings(lang)}
    />
  );
}
