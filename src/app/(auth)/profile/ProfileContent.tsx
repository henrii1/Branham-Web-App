"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguagePicker } from "@/components/auth/LanguagePicker";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";
import Link from "next/link";

interface ProfileContentProps {
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
  currentLanguage: string;
}

export function ProfileContent({
  user,
  currentLanguage,
}: ProfileContentProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleThemeChange(nextTheme: ThemePreference) {
    if (nextTheme === theme || savingTheme) return;

    const previousTheme = theme;
    setThemeError(null);
    setTheme(nextTheme);
    setSavingTheme(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: nextTheme })
      .eq("user_id", user.id);

    if (error) {
      setTheme(previousTheme);
      setThemeError(
        error.message.includes("theme_preference")
          ? "Theme sync is not available until the database migration is applied."
          : "Failed to save theme. Please try again.",
      );
      setSavingTheme(false);
      return;
    }

    setSavingTheme(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-5 shadow-sm dark:border-zinc-700">
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

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-5 shadow-sm dark:border-zinc-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-foreground">Appearance</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Choose the reading surface that feels best for long-form study.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Synced to your account
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            disabled={savingTheme}
            aria-pressed={theme === "light"}
            className={`rounded-2xl border p-4 text-left transition-all ${
              theme === "light"
                ? "border-zinc-900 bg-zinc-100 shadow-sm dark:border-zinc-100 dark:bg-zinc-800"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="mb-3 flex h-16 rounded-xl border border-zinc-200 bg-[#f4f4f5] p-2 dark:border-zinc-700">
              <div className="w-1/3 rounded-lg bg-white shadow-sm" />
              <div className="ml-2 flex-1 rounded-lg bg-[#ececf1]" />
            </div>
            <p className="text-sm font-medium text-foreground">Light</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Soft ChatGPT-style grays with a brighter canvas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            disabled={savingTheme}
            aria-pressed={theme === "dark"}
            className={`rounded-2xl border p-4 text-left transition-all ${
              theme === "dark"
                ? "border-zinc-900 bg-zinc-900 text-zinc-100 shadow-sm dark:border-zinc-100 dark:bg-zinc-800"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="mb-3 flex h-16 rounded-xl border border-zinc-700 bg-[#2a2c31] p-2">
              <div className="w-1/3 rounded-lg bg-[#24262b]" />
              <div className="ml-2 flex-1 rounded-lg bg-[#303239]" />
            </div>
            <p className="text-sm font-medium">Dark</p>
            <p className="mt-1 text-xs text-zinc-400">
              Graphite surfaces with gentler contrast than true black.
            </p>
          </button>
        </div>

        {themeError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {themeError}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Language</h2>
        <LanguagePicker
          userId={user.id}
          currentLanguage={currentLanguage}
          onSaved={() => router.refresh()}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-[var(--surface-soft)] p-5 shadow-sm dark:border-zinc-700">
        <h2 className="font-display text-xl text-foreground">Need help?</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Reach us at{" "}
          <a
            href="mailto:info@branhamsermons.ai"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600"
          >
            info@branhamsermons.ai
          </a>{" "}
          for account support, feedback, or feature requests.
        </p>
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <Link
          href="/chat"
          className="block w-full rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Back to chat
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full rounded-xl border border-red-200 bg-[var(--surface-base)] px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
