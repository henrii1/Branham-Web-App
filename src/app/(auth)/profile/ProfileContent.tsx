"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguagePicker } from "@/components/auth/LanguagePicker";
import { ThemePreferencePicker } from "@/components/auth/ThemePreferencePicker";
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
  isAdmin?: boolean;
}

export function ProfileContent({
  user,
  currentLanguage,
  isAdmin = false,
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

        <ThemePreferencePicker
          theme={theme}
          onThemeChange={handleThemeChange}
          disabled={savingTheme}
        />

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

      {isAdmin && (
        <div className="space-y-3">
          <Link
            href="/admin/send-email"
            className="block w-full rounded-xl border border-zinc-200 bg-[var(--surface-base)] px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Send bulk email
          </Link>
        </div>
      )}

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

        {/* The two operator accounts can't delete themselves; the API route
            enforces the same rule. */}
        {!isAdmin && <DeleteAccount email={user.email} />}
      </div>
    </div>
  );
}

// ── Delete account (deliberately low-key; archives, never hard-deletes) ──

function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  async function handleDelete() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !data?.ok) throw new Error();
      // Full navigation so every client-side cache of the old session goes.
      window.location.href = "/";
    } catch {
      setError(
        "Your account couldn't be deleted. Nothing was changed. Please try again, or email info@branhamsermons.ai.",
      );
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-zinc-400 underline decoration-zinc-300 underline-offset-[3px] transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:decoration-zinc-700 dark:hover:text-zinc-300"
        >
          Delete account
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-labelledby="delete-account-heading"
      className="space-y-3 rounded-2xl border border-red-200 bg-[var(--surface-base)] p-4 dark:border-red-900/60"
    >
      <h2 id="delete-account-heading" className="text-sm font-semibold text-foreground">
        Delete your account?
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        You&apos;ll be signed out and lose access to this account, including your
        saved conversations. Any links you&apos;ve shared will stop working. This
        can&apos;t be undone. Type{" "}
        <span className="font-medium text-foreground">{email}</span> to confirm.
      </p>
      <label htmlFor="delete-account-email" className="sr-only">
        Type your email to confirm
      </label>
      <input
        id="delete-account-email"
        type="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleDelete();
        }}
        placeholder={email}
        disabled={deleting}
        className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-zinc-300 focus:ring-2 focus:ring-red-500/40 dark:border-zinc-700 dark:placeholder:text-zinc-600"
      />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          disabled={deleting}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!matches || deleting}
          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </div>
  );
}
