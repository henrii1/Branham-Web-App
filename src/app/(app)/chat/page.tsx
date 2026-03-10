import { ChatShell } from "@/components/chat/ChatShell";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ welcomeEmail?: string }>;
}) {
  const { welcomeEmail } = await searchParams;

  return <ChatShell triggerWelcomeEmail={welcomeEmail === "1"} />;
}
