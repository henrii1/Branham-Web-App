import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ welcomeEmail?: string }>;
}) {
  const { conversationId } = await params;
  const { welcomeEmail } = await searchParams;

  return (
    <ChatShell
      initialConversationId={conversationId}
      triggerWelcomeEmail={welcomeEmail === "1"}
    />
  );
}
