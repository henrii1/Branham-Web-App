"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguagePicker } from "@/components/auth/LanguagePicker";
import Link from "next/link";

interface ProfileContentProps {
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
  currentLanguage: string;
}

export function ProfileContent({ user, currentLanguage }: ProfileContentProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Email
          </label>
          <p className="mt-1 text-sm text-foreground">{user.email}</p>
        </div>
        {user.displayName && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Display name
            </label>
            <p className="mt-1 text-sm text-foreground">{user.displayName}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Language preference
        </h2>
        <LanguagePicker
          userId={user.id}
          currentLanguage={currentLanguage}
          onSaved={() => router.refresh()}
        />
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <Link
          href="/chat"
          className="block w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750"
        >
          Back to chat
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
