"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemePreferencePicker } from "./ThemePreferencePicker";
import { LanguagePicker } from "./LanguagePicker";
import type { ThemePreference } from "@/lib/theme";

interface OnboardingPreferencesFormProps {
  userId: string;
  redirectTo: string;
  currentLanguage?: string;
}

export function OnboardingPreferencesForm({
  userId,
  redirectTo,
  currentLanguage = "en",
}: OnboardingPreferencesFormProps) {
  const { theme, setTheme } = useTheme();
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  async function handleThemeChange(nextTheme: ThemePreference) {
    if (nextTheme === theme || savingTheme) {
      return;
    }

    const previousTheme = theme;
    setThemeError(null);
    setTheme(nextTheme);
    setSavingTheme(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: nextTheme })
      .eq("user_id", userId);

    if (error) {
      setTheme(previousTheme);
      setThemeError(
        error.message.includes("theme_preference")
          ? "Background sync is not available until the database migration is applied. You can still finish signup and update it later from your profile."
          : "Failed to save background preference. You can still finish signup and update it later from your profile.",
      );
      setSavingTheme(false);
      return;
    }

    setSavingTheme(false);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-5 shadow-sm dark:border-zinc-700">
        <div className="space-y-1">
          <h2 className="font-display text-xl text-foreground">Background</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Pick the reading surface you want to land on after signup.
          </p>
        </div>

        <ThemePreferencePicker
          theme={theme}
          onThemeChange={handleThemeChange}
          disabled={savingTheme}
        />

        {savingTheme && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Saving background preference...
          </p>
        )}

        {themeError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {themeError}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Language</h2>
        <LanguagePicker
          userId={userId}
          currentLanguage={currentLanguage}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
