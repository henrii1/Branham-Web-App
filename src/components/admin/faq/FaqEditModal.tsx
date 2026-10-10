"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FaqLanguage } from "@/lib/faq/entry";
import {
  AdminDialog,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  FaqAnswerPreview,
  postJson,
} from "./AdminDialog";

const LANG_LABEL: Record<FaqLanguage, string> = { en: "English", es: "Spanish", fr: "French" };

/**
 * Admin-only: edit the question and answer of the FAQ page being viewed (this
 * language only). The page address never changes, so existing links keep
 * working.
 */
export function FaqEditModal({
  slug,
  language,
  question: initialQuestion,
  answerMarkdown: initialAnswer,
  onClose,
}: {
  slug: string;
  language: FaqLanguage;
  question: string;
  answerMarkdown: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState(initialAnswer);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changed = question.trim() !== initialQuestion.trim() || answer !== initialAnswer;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/faq/update", {
      slug,
      language,
      question,
      answer_markdown: answer,
    });
    if (status !== 200 || !data?.ok) {
      setError(data?.error === "invalid_request" ? "The question and answer can't be empty." : (data?.error ?? "Couldn't save. Your edit was not applied."));
      setSaving(false);
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/faq/delete", { slug });
    if (status !== 200 || !data?.ok) {
      setError(data?.error === "not_found" ? "This FAQ no longer exists." : (data?.error ?? "Couldn't delete. Nothing was removed."));
      setDeleting(false);
      return;
    }
    // Full navigation: this page no longer exists.
    window.location.href = language === "en" ? "/faq" : `/${language}/faq`;
  }

  const busy = saving || deleting;

  return (
    <AdminDialog title={`Edit FAQ (${LANG_LABEL[language]})`} onClose={onClose} closeDisabled={busy}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="faq-edit-question" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Question
          </label>
          <input
            id="faq-edit-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={saving}
            className={adminInputClass}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="faq-edit-answer" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Answer
            </label>
            <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-xs font-medium text-foreground underline">
              {showPreview ? "Edit text" : "Preview"}
            </button>
          </div>
          {showPreview ? (
            <FaqAnswerPreview markdown={answer} language={language} />
          ) : (
            <textarea
              id="faq-edit-answer"
              rows={16}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={saving}
              className={`${adminInputClass} resize-y font-mono text-xs`}
            />
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Keep citations in their bracket form, e.g. [SERMON TITLE — 63-0324E: ¶12–¶14], so they stay clickable. This edits the {LANG_LABEL[language]} page only.
          </p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

        {confirmingDelete ? (
          <div className="space-y-3 rounded-xl border border-red-200 p-4 dark:border-red-900/60">
            <p className="text-sm text-foreground">
              Delete this FAQ in English, Spanish and French? All three pages will stop working. You can add the question again later as a new FAQ.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className={adminSecondaryButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete in all languages"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy || confirmingDelete}
            className="text-xs text-zinc-400 underline underline-offset-[3px] hover:text-red-600 disabled:opacity-40 dark:text-zinc-500"
          >
            Delete FAQ
          </button>
          <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={adminSecondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={busy || !changed || !question.trim() || !answer.trim()} className={adminPrimaryButtonClass}>
            {saving ? "Saving…" : "Save"}
          </button>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}
