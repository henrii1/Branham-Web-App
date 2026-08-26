"use client";

interface LanguageOnlyModalProps {
  languageName: string;
  onBack: () => void;
  onContinue: () => void;
}

export function LanguageOnlyModal({
  languageName,
  onBack,
  onContinue,
}: LanguageOnlyModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h2
              id="language-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {languageName} isn&apos;t available yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              We&apos;re working to add more languages. Right now, English,
              Español, and Français are supported — choose one of these to get
              started.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Choose a language
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Use English for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}