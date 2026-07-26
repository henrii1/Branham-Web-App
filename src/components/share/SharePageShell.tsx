"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthGate";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ReferencePopover } from "@/components/chat/ReferencePopover";
import { LoginModal } from "@/components/chat/LoginModal";
import { forkConversationFromShare } from "@/lib/chat/forkFromShare";
import type { Message } from "@/lib/chat/types";
import type { ChatStrings } from "@/lib/i18n/chatStrings";

interface SharePageShellProps {
  conversationId: string;
  shareHash: string;
  title: string | null;
  messages: Message[];
  isOwner: boolean;
  language: string;
  strings: ChatStrings;
}

export function SharePageShell({
  conversationId,
  shareHash,
  title,
  messages,
  isOwner,
  strings,
}: SharePageShellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [forking, setForking] = useState(false);

  async function handleContinue() {
    if (isOwner) {
      router.push(`/chat/${conversationId}`);
      return;
    }
    if (!user) {
      localStorage.setItem("pending_share_hash", shareHash);
      setShowLoginModal(true);
      return;
    }
    setForking(true);
    try {
      const newConversationId = await forkConversationFromShare(shareHash, user.id);
      if (newConversationId) router.push(`/chat/${newConversationId}`);
    } finally {
      setForking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8">
      <div className="mb-4 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {strings.shareReadOnlyBanner}
      </div>
      {title && (
        <h1 className="mb-6 text-xl font-semibold text-foreground">{title}</h1>
      )}
      <div className="flex flex-1 flex-col gap-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={handleContinue}
          disabled={forking}
          className={`rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${
            forking ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          {isOwner ? strings.shareContinueButton : strings.shareLoginToContinue}
        </button>
      </div>
      <ReferencePopover />
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
}
