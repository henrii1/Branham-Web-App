import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchShareByHash, fetchSharedMessages } from "@/lib/db/share-queries";
import { createClient } from "@/lib/supabase/server";
import { SharePageShell } from "@/components/share/SharePageShell";
import { getChatStrings } from "@/lib/i18n/chatStrings";
import type { Message } from "@/lib/chat/types";

const SITE_URL = "https://branhamsermons.ai";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  const share = await fetchShareByHash(hash);
  if (!share) return { title: "Not Found" };
  const title = share.title_snapshot ?? "Shared conversation";
  return {
    title: `${title} — Branham Sermons Assistant`,
    alternates: { canonical: `${SITE_URL}/share/${hash}` },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const share = await fetchShareByHash(hash);
  if (!share || share.language !== "en") notFound();

  const messageRows = await fetchSharedMessages(share.conversation_id, share.cutoff_created_at);
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
      language="en"
      strings={getChatStrings("en")}
    />
  );
}
