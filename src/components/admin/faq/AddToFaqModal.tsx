"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages } from "@/lib/db/queries";
import {
  faqPagePath,
  faqSlugify,
  FAQ_LANGUAGES,
  type FaqEntryDraft,
  type FaqLanguage,
} from "@/lib/faq/entry";
import {
  AdminDialog,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  FaqAnswerPreview,
  postJson,
} from "./AdminDialog";

const LANG_LABEL: Record<FaqLanguage, string> = { en: "English", es: "Spanish", fr: "French" };

interface Duplicate {
  slug: string;
  question: string;
}
interface Prepared {
  question: string;
  robust_query: string;
}
interface Generated {
  answer_markdown: string;
  rag_context: string;
  conversation_summary: string | null;
  meta_title: string;
  meta_description: string;
}
type GenState =
  | { status: "pending" }
  | { status: "running"; startedAt: number }
  | { status: "done"; result: Generated }
  | { status: "failed"; error: string };

type Phase = "loading" | "ineligible" | "question" | "preparing" | "generating" | "review" | "publishing" | "done";

const initialGen = (): Record<FaqLanguage, GenState> => ({
  en: { status: "pending" },
  es: { status: "pending" },
  fr: { status: "pending" },
});

/**
 * Admin-only: turn a single-turn conversation into a published FAQ entry in
 * en/es/fr. See docs/superpowers/specs/2026-10-09-add-to-faq-design.md.
 */
export function AddToFaqModal({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [ineligibleReason, setIneligibleReason] = useState("");
  const [question, setQuestion] = useState("");
  const [check, setCheck] = useState<{ status: "idle" | "checking" | "ok" | "duplicate" | "error"; duplicate?: Duplicate | null }>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Record<FaqLanguage, Prepared> | null>(null);
  const [gen, setGen] = useState<Record<FaqLanguage, GenState>>(initialGen);
  const [drafts, setDrafts] = useState<Record<FaqLanguage, { question: string; answer: string }> | null>(null);
  const [tab, setTab] = useState<FaqLanguage>("en");
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const checkSeq = useRef(0);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Results of finished languages, kept across a retry of a later language.
  const resultsRef = useRef<Partial<Record<FaqLanguage, Generated>>>({});

  /** Debounced duplicate check; called on open and on every question edit. */
  const scheduleCheck = useCallback((value: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const q = value.trim();
    const seq = ++checkSeq.current;
    if (q.length < 3) {
      setCheck({ status: "idle" });
      return;
    }
    setCheck({ status: "checking" });
    checkTimer.current = setTimeout(async () => {
      const { status, data } = await postJson<{ ok: boolean; duplicate: Duplicate | null }>("/api/admin/faq/check", { question: q });
      if (seq !== checkSeq.current) return;
      if (status !== 200 || !data?.ok) setCheck({ status: "error" });
      else setCheck(data.duplicate ? { status: "duplicate", duplicate: data.duplicate } : { status: "ok" });
    }, 450);
  }, []);

  useEffect(() => () => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
  }, []);

  // ── Eligibility: exactly one question and one answer ──
  useEffect(() => {
    let cancelled = false;
    fetchMessages(conversationId)
      .then((rows) => {
        if (cancelled) return;
        const users = rows.filter((r) => r.role === "user");
        const assistants = rows.filter((r) => r.role === "assistant");
        if (users.length !== 1 || assistants.length !== 1) {
          setIneligibleReason(
            users.length === 0
              ? "This conversation has no question yet."
              : `Only conversations with one question and one answer can become an FAQ. This one has ${users.length} questions.`,
          );
          setPhase("ineligible");
          return;
        }
        const q = users[0].content.trim();
        setQuestion(q);
        setPhase("question");
        scheduleCheck(q);
      })
      .catch(() => {
        if (cancelled) return;
        setIneligibleReason("Couldn't load this conversation. Close and try again.");
        setPhase("ineligible");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, scheduleCheck]);

  // Elapsed-seconds display while a language is generating.
  useEffect(() => {
    if (phase !== "generating") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const runGeneration = useCallback(async (prep: Record<FaqLanguage, Prepared>, from: FaqLanguage) => {
    setPhase("generating");
    setError(null);
    const start = FAQ_LANGUAGES.indexOf(from);
    for (const lang of FAQ_LANGUAGES.slice(start)) {
      setGen((g) => ({ ...g, [lang]: { status: "running", startedAt: Date.now() } }));
      const { status, data } = await postJson<{ ok: boolean; result?: Generated; error?: string }>("/api/admin/faq/generate", {
        language: lang,
        question: prep[lang].question,
        robust_query: prep[lang].robust_query,
      });
      if (status !== 200 || !data?.ok || !data.result) {
        setGen((g) => ({ ...g, [lang]: { status: "failed", error: data?.error ?? `Request failed (${status}).` } }));
        return; // stop here; the admin can retry this language
      }
      const result = data.result;
      resultsRef.current[lang] = result;
      setGen((g) => ({ ...g, [lang]: { status: "done", result } }));
    }
    const next = {} as Record<FaqLanguage, { question: string; answer: string }>;
    for (const lang of FAQ_LANGUAGES) {
      next[lang] = { question: prep[lang].question, answer: resultsRef.current[lang]!.answer_markdown };
    }
    setDrafts(next);
    setTab("en");
    setPhase("review");
  }, []);

  async function handlePrepare() {
    setPhase("preparing");
    setError(null);
    const { status, data } = await postJson<{
      ok: boolean;
      error?: string;
      results?: Record<FaqLanguage, Prepared>;
      duplicate?: Duplicate | null;
    }>("/api/admin/faq/prepare", { question: question.trim() });
    if (status !== 200 || !data?.ok || !data.results) {
      setError(data?.error ?? "Couldn't prepare the question. Try again.");
      setPhase("question");
      return;
    }
    if (data.duplicate) {
      setCheck({ status: "duplicate", duplicate: data.duplicate });
      setError(`The prepared title "${data.results.en.question}" matches an existing FAQ. Reword the question to make a different entry.`);
      setPhase("question");
      return;
    }
    setPrepared(data.results);
    resultsRef.current = {};
    setGen(initialGen());
    void runGeneration(data.results, "en");
  }

  async function handlePublish() {
    if (!drafts || !prepared) return;
    setPhase("publishing");
    setError(null);
    const entries = {} as Record<FaqLanguage, FaqEntryDraft>;
    for (const lang of FAQ_LANGUAGES) {
      const g = gen[lang];
      if (g.status !== "done") return;
      entries[lang] = {
        ...g.result,
        question: drafts[lang].question,
        robust_query: prepared[lang].robust_query,
        answer_markdown: drafts[lang].answer,
      };
    }
    const { status, data } = await postJson<{ ok: boolean; slug?: string; error?: string }>("/api/admin/faq/publish", { entries });
    if (status !== 200 || !data?.ok || !data.slug) {
      setError(data?.error ?? "Couldn't publish. Nothing was saved. Try again.");
      setPhase("review");
      return;
    }
    setPublishedSlug(data.slug);
    setPhase("done");
  }

  const busy = phase === "preparing" || phase === "generating" || phase === "publishing";
  const currentSlug = drafts ? faqSlugify(drafts.en.question) : "";

  return (
    <AdminDialog title="Add to FAQ" onClose={onClose} closeDisabled={busy}>
      {phase === "loading" && <p className="text-sm text-zinc-500">Loading the conversation…</p>}

      {phase === "ineligible" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{ineligibleReason}</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>Close</button>
          </div>
        </div>
      )}

      {(phase === "question" || phase === "preparing") && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="faq-question" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Question
            </label>
            <textarea
              id="faq-question"
              rows={2}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                scheduleCheck(e.target.value);
              }}
              disabled={phase === "preparing"}
              className={`${adminInputClass} resize-y`}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Any language. It will be shaped into a public FAQ title and translated into English, Spanish and French.
            </p>
          </div>

          {check.status === "checking" && <p className="text-xs text-zinc-500">Checking for an existing FAQ…</p>}
          {check.status === "duplicate" && check.duplicate && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
              An FAQ for this already exists:{" "}
              <a href={faqPagePath(check.duplicate.slug, "en")} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                {check.duplicate.question}
              </a>
              . Reword the question to make a different entry.
            </div>
          )}
          {check.status === "error" && <p className="text-xs text-red-600 dark:text-red-400">Couldn&apos;t check for duplicates. Edit the question to try again.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Generating takes about 2 minutes (three answers).</p>
            <button
              type="button"
              onClick={handlePrepare}
              disabled={phase === "preparing" || check.status !== "ok"}
              className={adminPrimaryButtonClass}
            >
              {phase === "preparing" ? "Preparing…" : "Generate FAQ"}
            </button>
          </div>
        </div>
      )}

      {phase === "generating" && prepared && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Generating <span className="font-medium text-foreground">{prepared.en.question}</span>. Keep this window open.
          </p>
          <ul className="space-y-2">
            {FAQ_LANGUAGES.map((lang) => {
              const g = gen[lang];
              return (
                <li key={lang} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
                  <span className="font-medium text-foreground">{LANG_LABEL[lang]}</span>
                  <span className="text-right text-zinc-500 dark:text-zinc-400">
                    {g.status === "pending" && "Waiting"}
                    {g.status === "running" && `Generating… ${Math.max(0, Math.round((now - g.startedAt) / 1000))}s`}
                    {g.status === "done" && <span className="text-green-700 dark:text-green-400">Ready</span>}
                    {g.status === "failed" && (
                      <span className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400">{g.error}</span>
                        <button type="button" onClick={() => runGeneration(prepared, lang)} className="font-medium text-foreground underline">
                          Retry
                        </button>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(phase === "review" || phase === "publishing") && drafts && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700" role="tablist">
            {FAQ_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                role="tab"
                aria-selected={tab === lang}
                onClick={() => {
                  setTab(lang);
                  setEditingAnswer(false);
                }}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === lang ? "border-zinc-900 text-foreground dark:border-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {LANG_LABEL[lang]}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="faq-review-question" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Question ({LANG_LABEL[tab]})
            </label>
            <input
              id="faq-review-question"
              value={drafts[tab].question}
              onChange={(e) => setDrafts({ ...drafts, [tab]: { ...drafts[tab], question: e.target.value } })}
              disabled={phase === "publishing"}
              className={adminInputClass}
            />
            {tab === "en" && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Page address: <span className="font-mono">/q/{currentSlug}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Answer</span>
              <button type="button" onClick={() => setEditingAnswer((v) => !v)} disabled={phase === "publishing"} className="text-xs font-medium text-foreground underline">
                {editingAnswer ? "Show preview" : "Edit answer text"}
              </button>
            </div>
            {editingAnswer ? (
              <textarea
                aria-label={`Answer (${LANG_LABEL[tab]})`}
                rows={14}
                value={drafts[tab].answer}
                onChange={(e) => setDrafts({ ...drafts, [tab]: { ...drafts[tab], answer: e.target.value } })}
                className={`${adminInputClass} resize-y font-mono text-xs`}
              />
            ) : (
              <FaqAnswerPreview markdown={drafts[tab].answer} language={tab} />
            )}
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Check all three languages. Publishing makes them public.</p>
            <button
              type="button"
              onClick={handlePublish}
              disabled={phase === "publishing" || FAQ_LANGUAGES.some((l) => !drafts[l].question.trim() || !drafts[l].answer.trim()) || !currentSlug}
              className={adminPrimaryButtonClass}
            >
              {phase === "publishing" ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && publishedSlug && drafts && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Published in all three languages.</p>
          <ul className="space-y-1.5 text-sm">
            {FAQ_LANGUAGES.map((lang) => (
              <li key={lang}>
                <span className="text-zinc-500">{LANG_LABEL[lang]}: </span>
                <a href={faqPagePath(publishedSlug, lang)} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline">
                  {drafts[lang].question}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={adminSecondaryButtonClass}>Close</button>
          </div>
        </div>
      )}
    </AdminDialog>
  );
}
