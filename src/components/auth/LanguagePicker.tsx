"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  type Language,
} from "@/lib/constants/languages";
import { LanguageOnlyModal } from "./LanguageOnlyModal";

interface LanguagePickerProps {
  userId: string;
  currentLanguage?: string;
  redirectTo?: string;
  onSaved?: () => void;
}

export function LanguagePicker({
  userId,
  currentLanguage = "en",
  redirectTo,
  onSaved,
}: LanguagePickerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return LANGUAGES;
    const q = search.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase() === q
    );
  }, [search]);

  function handleSelect(lang: Language) {
    setSelected(lang.code);
    setError(null);
    setSuccessMessage(null);

    if (!SUPPORTED_LANGUAGES.includes(lang.code)) {
      setPendingLanguage(lang);
      setShowModal(true);
    }
  }

  async function saveAndProceed(languageCode: string) {
    setSaving(true);
    setError(null);

    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ language: languageCode })
      .eq("user_id", userId);

    if (profileError) {
      setError("Failed to save language. Please try again.");
      setSaving(false);
      return;
    }

    if (redirectTo) {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      });

      if (metaError) {
        setError("Failed to complete setup. Please try again.");
        setSaving(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } else {
      setSuccessMessage("Language updated successfully.");
      setSaving(false);
      onSaved?.();
    }
  }

  function handleModalContinue() {
    setShowModal(false);
    setPendingLanguage(null);
    saveAndProceed(selected);
  }

  const isOnboarding = !!redirectTo;
  const hasChanged = selected !== currentLanguage;

  return (
    <>
      <div className="space-y-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
        />

        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {filtered.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang)}
              disabled={saving}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected === lang.code
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  selected === lang.code
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-foreground"
                }`}
              >
                {lang.nativeName}
              </span>
              {lang.nativeName !== lang.name && (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {lang.name}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-4 text-center text-sm text-zinc-400">
              No languages match your search.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
            {successMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => saveAndProceed(selected)}
          disabled={saving || (!isOnboarding && !hasChanged)}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving
            ? "Saving..."
            : isOnboarding
              ? "Continue"
              : "Save language"}
        </button>
      </div>

      {showModal && pendingLanguage && (
        <LanguageOnlyModal
          languageName={pendingLanguage.name}
          onContinue={handleModalContinue}
        />
      )}
    </>
  );
}
