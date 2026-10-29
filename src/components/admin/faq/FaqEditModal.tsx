"use client";

import { useEffect, useState } from "react";
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
import type { FaqGroup } from "@/lib/faq/groups";

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
  const [groups, setGroups] = useState<FaqGroup[] | null>(null);
  const [initialGroupId, setInitialGroupId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    postJson<{ ok: boolean; groups?: FaqGroup[]; current_group_id?: string | null }>("/api/admin/faq/groups", { slug }).then(({ status, data }) => {
      if (cancelled || status !== 200 || !data?.ok || !data.groups) return;
      // No stored group counts as the doctrinal group.
      const current = data.current_group_id ?? data.groups.find((g) => g.kind === "doctrinal")?.id ?? "";
      setGroups(data.groups);
      setInitialGroupId(current);
      setGroupId(current);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // English pages: carry an edit into Spanish and French (Model API sync-edit),
  // reviewed here before anything is saved.
  const [syncing, setSyncing] = useState(false);
  const [review, setReview] = useState<{
    texts: Record<FaqLanguage, { question: string; answer: string }>;
    notes: Record<"es" | "fr", string[]>;
    enCorrected: boolean;
  } | null>(null);
  const [reviewTab, setReviewTab] = useState<FaqLanguage>("en");

  const textChanged = question.trim() !== initialQuestion.trim() || answer !== initialAnswer;
  const groupChanged = !!groupId && groupId !== initialGroupId;
  const changed = textChanged || groupChanged;

  async function handleSave() {
    setSaving(true);
    setError(null);
    if (textChanged) {
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
    }
    if (groupChanged) {
      const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/faq/move", { slug, group_id: groupId });
      if (status !== 200 || !data?.ok) {
        setError(`${textChanged ? "Your text was saved, but the" : "The"} group wasn't changed: ${data?.error ?? "try again."}`);
        setSaving(false);
        return;
      }
    }
    router.refresh();
    onClose();
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    const { status, data } = await postJson<{
      ok: boolean;
      error?: string;
      en?: { question: string; answer: string; changed: boolean };
      es?: { question: string; answer: string; notes: string[] };
      fr?: { question: string; answer: string; notes: string[] };
    }>("/api/admin/faq/sync-edit", {
      slug,
      en: { question_before: initialQuestion, question_after: question, answer_before: initialAnswer, answer_after: answer },
    });
    setSyncing(false);
    if (status !== 200 || !data?.ok || !data.en || !data.es || !data.fr) {
      setError(data?.error ?? "Couldn't update Spanish and French. Try again.");
      return;
    }
    setReview({
      texts: {
        en: { question: data.en.question, answer: data.en.answer },
        es: { question: data.es.question, answer: data.es.answer },
        fr: { question: data.fr.question, answer: data.fr.answer },
      },
      notes: { es: data.es.notes, fr: data.fr.notes },
      enCorrected: data.en.changed,
    });
    setReviewTab("en");
  }

  /** Save the reviewed English, Spanish and French (and a group change). */
  async function handleSaveAll() {
    if (!review) return;
    setSaving(true);
    setError(null);
    const saved: FaqLanguage[] = [];
    for (const lang of ["en", "es", "fr"] as FaqLanguage[]) {
      const t = review.texts[lang];
      const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/faq/update", {
        slug,
        language: lang,
        question: t.question,
        answer_markdown: t.answer,
      });
      if (status !== 200 || !data?.ok) {
        const done = saved.map((l) => LANG_LABEL[l]).join(" and ");
        setError(`${done ? `${done} saved, but ` : ""}${LANG_LABEL[lang]} wasn't: ${data?.error === "invalid_request" ? "the question and answer can't be empty" : (data?.error ?? "try again")}.`);
        setSaving(false);
        return;
      }
      saved.push(lang);
    }
    if (groupChanged) {
      const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/faq/move", { slug, group_id: groupId });
      if (status !== 200 || !data?.ok) {
        setError(`All three languages were saved, but the group wasn't changed: ${data?.error ?? "try again."}`);
        setSaving(false);
        return;
      }
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

  const busy = saving || deleting || syncing;

  if (review) {
    const t = review.texts[reviewTab];
    const setText = (patch: Partial<{ question: string; answer: string }>) =>
      setReview({ ...review, texts: { ...review.texts, [reviewTab]: { ...t, ...patch } } });
    return (
      <AdminDialog title="Review all three languages" onClose={onClose} closeDisabled={busy}>
        <div className="space-y-4">
          <div className="space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
            <p>
              Your English edit was applied to Spanish and French{review.enCorrected ? ", and the English spelling and grammar were corrected" : ""}. Nothing is saved yet.
            </p>
            {(["es", "fr"] as const).flatMap((l) => review.notes[l].map((n, i) => (
              <p key={`${l}${i}`} className="text-amber-700 dark:text-amber-400">{LANG_LABEL[l]}: {n}</p>
            )))}
          </div>

          <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700" role="tablist">
            {(["en", "es", "fr"] as FaqLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                role="tab"
                aria-selected={reviewTab === lang}
                onClick={() => setReviewTab(lang)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  reviewTab === lang ? "border-zinc-900 text-foreground dark:border-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {LANG_LABEL[lang]}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="faq-sync-question" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Question ({LANG_LABEL[reviewTab]})
            </label>
            <input id="faq-sync-question" value={t.question} onChange={(e) => setText({ question: e.target.value })} disabled={saving} className={adminInputClass} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="faq-sync-answer" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Answer
              </label>
              <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-xs font-medium text-foreground underline">
                {showPreview ? "Edit text" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <FaqAnswerPreview markdown={t.answer} language={reviewTab} />
            ) : (
              <textarea id="faq-sync-answer" rows={14} value={t.answer} onChange={(e) => setText({ answer: e.target.value })} disabled={saving} className={`${adminInputClass} resize-y font-mono text-xs`} />
            )}
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setReview(null)} disabled={saving} className={adminSecondaryButtonClass}>
              Back to editing
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || (["en", "es", "fr"] as FaqLanguage[]).some((l) => !review.texts[l].question.trim() || !review.texts[l].answer.trim())}
              className={adminPrimaryButtonClass}
            >
              {saving ? "Saving…" : "Save all three languages"}
            </button>
          </div>
        </div>
      </AdminDialog>
    );
  }

  return (
    <AdminDialog title={`Edit FAQ (${LANG_LABEL[language]})`} onClose={onClose} closeDisabled={busy}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="faq-edit-group" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Group
          </label>
          <select
            id="faq-edit-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={saving || !groups}
            className={adminInputClass}
          >
            {!groups && <option value="">Loading groups…</option>}
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name_en}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Moves this FAQ in all three languages. The answer isn&apos;t rewritten; to change how it&apos;s answered, delete it and add it again in the new group.
          </p>
        </div>

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
            Keep citations in their bracket form, e.g. [SERMON TITLE — 63-0324E: ¶12–¶14], so they stay clickable.{" "}
            {language === "en"
              ? "Save English only, or use Update Spanish & French to carry your edit into the other two pages and review them first."
              : `This edits the ${LANG_LABEL[language]} page only.`}
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
          {language === "en" && textChanged && (
            <button type="button" onClick={handleSync} disabled={busy || !question.trim() || !answer.trim()} className={adminSecondaryButtonClass}>
              {syncing ? "Updating…" : "Update Spanish & French"}
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={busy || !changed || !question.trim() || !answer.trim()} className={adminPrimaryButtonClass}>
            {saving ? "Saving…" : language === "en" && textChanged ? "Save English only" : "Save"}
          </button>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}
