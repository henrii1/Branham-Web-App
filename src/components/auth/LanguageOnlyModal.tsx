"use client";

interface LanguageOnlyModalProps {
  languageName: string;
  onContinue: () => void;
}

export function LanguageOnlyModal({
  languageName,
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
              English only (for now)
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Only English is supported right now. We&apos;re actively working
              to extend support to {languageName} and other languages in
              upcoming updates.
            </p>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">
              Your language preference has been saved and will be used when
              support becomes available.
            </p>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continue in English
          </button>
        </div>
      </div>
    </div>
  );
}
