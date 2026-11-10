"use client";

import { useState } from "react";
import { copyMarkdown } from "@/lib/markdown/copyText";

type CopyLang = "en" | "es" | "fr";

const COPY: Record<CopyLang, { copy: string; copied: string }> = {
  en: { copy: "Copy", copied: "Copied" },
  es: { copy: "Copiar", copied: "Copiado" },
  fr: { copy: "Copier", copied: "Copié" },
};

/**
 * Copies an answer (markdown, built on tap) with its citations. Used under
 * chat answers, FAQ answers and the Family Altar devotion.
 */
export function CopyButton({ getMarkdown, language, label, className = "" }: { getMarkdown: () => string; language?: string | null; label?: string; className?: string }) {
  const c = COPY[language === "es" || language === "fr" ? language : "en"];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyMarkdown(getMarkdown())) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 ${className}`}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
        </svg>
      )}
      <span aria-live="polite">{copied ? c.copied : (label ?? c.copy)}</span>
    </button>
  );
}
