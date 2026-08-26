"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  type Language,
} from "@/lib/constants/languages";
import { LanguageOnlyModal } from "./LanguageOnlyModal";

 const CORPUS_TOOLTIPS: Record<string, string> = {
  es: "Solo 385 de 1,205 sermones están indexados en español.",
  fr: "Seulement 359 des 1,205 sermons sont indexés en français.",
};

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
  const normalizedCurrentLanguage = normalizeLanguageCode(currentLanguage);
  const [selected, setSelected] = useState(normalizedCurrentLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(normalizedCurrentLanguage);
  }, [normalizedCurrentLanguage]);

  const isSearching = !!search.trim();

  const filtered = useMemo(() => {
    if (!isSearching) return LANGUAGES;
    const q = search.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase() === q
    );
  }, [search, isSearching]);

  const supportedLangs = useMemo(
    () => LANGUAGES.filter((l) => SUPPORTED_LANGUAGES.includes(l.code)),
    [],
  );
  const otherLangs = useMemo(
    () => LANGUAGES.filter((l) => !SUPPORTED_LANGUAGES.includes(l.code)),
    [],
  );

  function handleSelect(lang: Language) {
    setError(null);
    setSuccessMessage(null);

    if (!SUPPORTED_LANGUAGES.includes(lang.code)) {
      setPendingLanguage(lang);
      setShowModal(true);
      setSelected("en");
      return;
    }

    setPendingLanguage(null);
    setSelected(lang.code);
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

      router.push(appendWelcomeEmailFlag(redirectTo));
      router.refresh();
    } else {
      setSuccessMessage("Language updated successfully.");
      setSaving(false);
      onSaved?.();
    }
  }

  function handleModalBack() {
    setShowModal(false);
    setPendingLanguage(null);
  }

  function handleModalContinue() {
    setShowModal(false);
    setPendingLanguage(null);
    setSelected("en");
    void saveAndProceed("en");
  }

  const isOnboarding = !!redirectTo;
  const hasChanged = selected !== normalizedCurrentLanguage;

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

        {isSearching ? (
          /* Flat search results */
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {filtered.map((lang) => (
              <LangButton
                key={lang.code}
                lang={lang}
                selected={selected}
                saving={saving}
                onSelect={handleSelect}
              />
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-4 text-center text-sm text-zinc-400">
                No languages match your search.
              </p>
            )}
          </div>
        ) : (
          /* Two-section layout */
          <div className="space-y-3">
            {/* Supported section — outside scroll so tooltips aren't clipped */}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Available now
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {supportedLangs.map((lang) => (
                  <LangButton
                    key={lang.code}
                    lang={lang}
                    selected={selected}
                    saving={saving}
                    onSelect={handleSelect}
                    tooltip={CORPUS_TOOLTIPS[lang.code]}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Other languages
              </p>
              <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {otherLangs.map((lang) => (
                  <LangButton
                    key={lang.code}
                    lang={lang}
                    selected={selected}
                    saving={saving}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

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
          onBack={handleModalBack}
          onContinue={handleModalContinue}
        />
      )}
    </>
  );
}

interface LangButtonProps {
  lang: Language;
  selected: string;
  saving: boolean;
  onSelect: (lang: Language) => void;
  tooltip?: string;
}

function LangButton({ lang, selected, saving, onSelect, tooltip }: LangButtonProps) {
  const isSelected = selected === lang.code;

  const button = (
    <button
      type="button"
      onClick={() => onSelect(lang)}
      disabled={saving}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
      }`}
    >
      <span
        className={`block text-sm font-medium ${
          isSelected ? "text-blue-700 dark:text-blue-300" : "text-foreground"
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
  );

  if (!tooltip) return button;

  return (
    <div className="group relative">
      {button}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
        role="tooltip"
      >
        {tooltip}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
      </div>
    </div>
  );
}

function appendWelcomeEmailFlag(target: string): string {
  const url = new URL(target, window.location.origin);
  url.searchParams.set("welcomeEmail", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeLanguageCode(languageCode?: string | null): string {
  return SUPPORTED_LANGUAGES.includes(languageCode ?? "")
    ? languageCode!
    : "en";
}