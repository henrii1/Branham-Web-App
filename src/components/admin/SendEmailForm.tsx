"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { applyGreeting, type EmailLanguage } from "@/lib/email/greeting";

const LANGUAGE_OPTIONS: { code: EmailLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

type Phase = "compose" | "confirming" | "sending" | "done";

interface SendSummary {
  total: number;
  sent: number;
  failed: number;
}

async function postSendEmail(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/admin/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.ok) {
    throw new Error((data.error as string | undefined) || `Request failed (${res.status})`);
  }
  return data;
}

export function SendEmailForm() {
  const [language, setLanguage] = useState<EmailLanguage>("en");
  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [phase, setPhase] = useState<Phase>("compose");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewBody = useMemo(
    () => applyGreeting(bodyMarkdown, language, "Sample Recipient"),
    [bodyMarkdown, language],
  );

  const canContinue = subject.trim().length > 0 && bodyMarkdown.trim().length > 0;

  async function handleContinue() {
    setError(null);
    try {
      const data = await postSendEmail({ language, confirm: false });
      setRecipientCount(data.recipientCount as number);
      setConfirmChecked(false);
      setPhase("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleConfirmSend() {
    setError(null);
    setPhase("sending");
    try {
      const data = await postSendEmail({ language, subject, bodyMarkdown, confirm: true });
      setSummary({
        total: data.total as number,
        sent: data.sent as number,
        failed: data.failed as number,
      });
      setPhase("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        `${message} This request may have partially completed — check Postmark's activity feed before retrying.`,
      );
      setConfirmChecked(false);
      setPhase("confirming");
    }
  }

  function handleStartOver() {
    setSubject("");
    setBodyMarkdown("");
    setSummary(null);
    setError(null);
    setPhase("compose");
  }

  if (phase === "done" && summary) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-6 dark:border-zinc-700">
        <h2 className="font-display text-xl text-foreground">Send complete</h2>
        <p className="text-sm text-foreground">
          {summary.sent} sent, {summary.failed} failed, out of {summary.total} recipients.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStartOver}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Send another
          </button>
          <Link
            href="/profile"
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[var(--surface-base)] p-6 dark:border-zinc-700">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as EmailLanguage)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Only sent to users whose saved language preference matches this selection.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Body
          </label>
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-[var(--surface-base)] px-3 py-2 text-sm text-foreground dark:border-zinc-700"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            A greeting line is added automatically for each recipient — don&rsquo;t include your
            own &ldquo;Dear...&rdquo; line unless you specifically want it replaced.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue
        </button>
      </div>

      {(phase === "confirming" || phase === "sending") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-[var(--surface-base)] p-6 shadow-xl">
            <h2 className="font-display text-xl text-foreground">Confirm send</h2>
            <p className="text-sm text-foreground">
              You&rsquo;re about to email <strong>{recipientCount}</strong> user
              {recipientCount === 1 ? "" : "s"} in{" "}
              {LANGUAGE_OPTIONS.find((o) => o.code === language)?.label}.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="font-medium text-foreground">{subject}</p>
              <p className="mt-2 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {previewBody}
              </p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Preview shown with a sample name — each recipient sees their own name (or a
              generic greeting if none is on file) in place of &ldquo;Sample Recipient&rdquo;.
            </p>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={phase === "sending"}
                className="mt-0.5"
              />
              I&rsquo;ve read this email and confirm it&rsquo;s ready to send.
            </label>
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("compose")}
                disabled={phase === "sending"}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={!confirmChecked || phase === "sending"}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phase === "sending" ? "Sending…" : "Send to all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
