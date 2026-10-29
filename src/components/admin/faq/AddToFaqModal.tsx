"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages } from "@/lib/db/queries";
import {
  faqMetaTitle,
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
import { MAX_GROUP_NAME_CHARS, MAX_GUIDANCE_CHARS, type FaqGroup, type FaqKind } from "@/lib/faq/groups";

const LANG_LABEL: Record<FaqLanguage, string> = { en: "English", es: "Spanish", fr: "French" };

interface Duplicate {
  slug: string;
  question: string;
}
interface Prepared {
  question: string;
  robust_query: string;
  group_name?: string;
}
const NEW_GROUP = "__new__";
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

type Phase = "loading" | "ineligible" | "question" | "preparing" | "generating" | "translating" | "review" | "publishing" | "done";
type Drafts = Record<FaqLanguage, { question: string; answer: string }>;

// "Write it myself": the admin's English answer is sent to /api/faq/sync-edit
// as an edit from this placeholder, so the API proofreads all of it and
// writes the whole answer into Spanish and French (citations localized from
// each corpus). The same placeholder stands in for the es/fr answers.
const ANSWER_PLACEHOLDER = "(Answer not written yet.)";
const MAX_ANSWER_CHARS = 40_000;

const initialGen = (): Record<FaqLanguage, GenState> => ({
  en: { status: "pending" },
  es: { status: "pending" },
  fr: { status: "pending" },
});

/**
 * Admin-only: publish an FAQ entry in en/es/fr, either from a single-turn
 * conversation (`conversationId`, its question prefilled) or from scratch
 * (no conversation: opened from the profile page with an empty question).
 * See docs/superpowers/specs/2026-10-09-add-to-faq-design.md.
 */
export function AddToFaqModal({ conversationId = null, onClose }: { conversationId?: string | null; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(conversationId ? "loading" : "question");
  const [ineligibleReason, setIneligibleReason] = useState("");
  const [question, setQuestion] = useState("");
  const [check, setCheck] = useState<{ status: "idle" | "checking" | "ok" | "duplicate" | "error"; duplicate?: Duplicate | null }>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Record<FaqLanguage, Prepared> | null>(null);
  const [gen, setGen] = useState<Record<FaqLanguage, GenState>>(initialGen);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [tab, setTab] = useState<FaqLanguage>("en");
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Group: an existing group's id, NEW_GROUP, or "" (not chosen yet).
  const [groups, setGroups] = useState<FaqGroup[] | null>(null);
  const [groupsError, setGroupsError] = useState(false);
  const [groupChoice, setGroupChoice] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  // Decided by the server from the group (prepare response).
  const [kind, setKind] = useState<FaqKind>("doctrinal");
  // A new group's names, translated by prepare and editable in review.
  const [groupNames, setGroupNames] = useState<Record<FaqLanguage, string> | null>(null);
  // Admin notes steering the answer (Model API faq_guidance). Used once, not stored.
  const [guidance, setGuidance] = useState("");
  const guidanceRef = useRef<string | undefined>(undefined);
  // Generate the answers, or translate the admin's own English answer.
  const [answerMode, setAnswerMode] = useState<"generate" | "write">("generate");
  const [ownAnswer, setOwnAnswer] = useState("");
  // The draft under review was written by the admin (no retrieval: no sources).
  const [curated, setCurated] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // English as last generated or synced: the "before" of an English edit.
  const [enBase, setEnBase] = useState<{ question: string; answer: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ translated: boolean; enCorrected: boolean; notes: Record<"es" | "fr", string[]> } | null>(null);
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

  // ── Groups for the picker ──
  useEffect(() => {
    let cancelled = false;
    postJson<{ ok: boolean; groups?: FaqGroup[] }>("/api/admin/faq/groups", {}).then(({ status, data }) => {
      if (cancelled) return;
      if (status !== 200 || !data?.ok || !data.groups) setGroupsError(true);
      else setGroups(data.groups);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Eligibility: exactly one question and one answer ──
  useEffect(() => {
    if (!conversationId) return; // from scratch: nothing to load
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

  const runGeneration = useCallback(async (prep: Record<FaqLanguage, Prepared>, from: FaqLanguage, faqKind: FaqKind) => {
    setPhase("generating");
    setError(null);
    const start = FAQ_LANGUAGES.indexOf(from);
    for (const lang of FAQ_LANGUAGES.slice(start)) {
      setGen((g) => ({ ...g, [lang]: { status: "running", startedAt: Date.now() } }));
      const { status, data } = await postJson<{ ok: boolean; result?: Generated; error?: string }>("/api/admin/faq/generate", {
        language: lang,
        question: prep[lang].question,
        robust_query: prep[lang].robust_query,
        faq_kind: faqKind,
        ...(guidanceRef.current ? { faq_guidance: guidanceRef.current } : {}),
      });
      if (status !== 200 || !data?.ok || !data.result) {
        setGen((g) => ({ ...g, [lang]: { status: "failed", error: data?.error ?? `Request failed (${status}).` } }));
        return; // stop here; the admin can retry this language
      }
      const result = data.result;
      resultsRef.current[lang] = result;
      setGen((g) => ({ ...g, [lang]: { status: "done", result } }));
    }
    const next = {} as Drafts;
    for (const lang of FAQ_LANGUAGES) {
      next[lang] = { question: prep[lang].question, answer: resultsRef.current[lang]!.answer_markdown };
    }
    setDrafts(next);
    setEnBase({ question: next.en.question, answer: next.en.answer });
    setSyncResult(null);
    setTab("en");
    setPhase("review");
  }, []);

  async function handlePrepare() {
    setPhase("preparing");
    setError(null);
    const writing = answerMode === "write";
    guidanceRef.current = writing ? undefined : guidance.trim() || undefined;
    const { status, data } = await postJson<{
      ok: boolean;
      error?: string;
      results?: Record<FaqLanguage, Prepared>;
      duplicate?: Duplicate | null;
      kind?: FaqKind;
    }>("/api/admin/faq/prepare", {
      question: question.trim(),
      ...(groupChoice === NEW_GROUP ? { new_group_name: newGroupName.trim() } : { group_id: groupChoice }),
      ...(guidanceRef.current ? { faq_guidance: guidanceRef.current } : {}),
    });
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
    const faqKind = data.kind ?? "doctrinal";
    setKind(faqKind);
    setGroupNames(
      groupChoice === NEW_GROUP
        ? { en: data.results.en.group_name ?? newGroupName.trim(), es: data.results.es.group_name ?? "", fr: data.results.fr.group_name ?? "" }
        : null,
    );
    setPrepared(data.results);
    resultsRef.current = {};
    setGen(initialGen());
    setCurated(writing);
    if (writing) void runTranslation(data.results, faqKind);
    else void runGeneration(data.results, "en", faqKind);
  }

  /** "Write it myself": proofread the admin's English answer and write it into Spanish and French. */
  async function runTranslation(prep: Record<FaqLanguage, Prepared>, faqKind: FaqKind) {
    setPhase("translating");
    const answer = ownAnswer.trim();
    const synced = await syncDrafts(
      faqKind,
      { question: prep.en.question, answer: ANSWER_PLACEHOLDER },
      {
        en: { question: prep.en.question, answer },
        es: { question: prep.es.question, answer: ANSWER_PLACEHOLDER },
        fr: { question: prep.fr.question, answer: ANSWER_PLACEHOLDER },
      },
      true,
    );
    if (!synced) {
      setPhase("question");
      return;
    }
    const done = {} as Record<FaqLanguage, GenState>;
    for (const lang of FAQ_LANGUAGES) {
      done[lang] = {
        status: "done",
        result: { answer_markdown: synced.drafts[lang].answer, rag_context: "", conversation_summary: null, meta_title: "", meta_description: "" },
      };
    }
    setGen(done);
    setTab("en");
    setPhase("review");
  }

  /**
   * Proofread the English changes from `base` to `current.en` and carry them
   * into the Spanish and French drafts (Model API /api/faq/sync-edit). On
   * success the result becomes the drafts and the new English base.
   */
  async function syncDrafts(
    faqKind: FaqKind,
    base: { question: string; answer: string },
    current: Drafts,
    translated = false,
  ): Promise<{ drafts: Drafts; notes: Record<"es" | "fr", string[]> } | null> {
    setSyncing(true);
    setError(null);
    const { status, data } = await postJson<{
      ok: boolean;
      error?: string;
      en?: { question: string; answer: string; changed: boolean };
      es?: { question: string; answer: string; notes: string[] };
      fr?: { question: string; answer: string; notes: string[] };
    }>("/api/admin/faq/sync-edit", {
      faq_kind: faqKind,
      en: { question_before: base.question, question_after: current.en.question, answer_before: base.answer, answer_after: current.en.answer },
      targets: { es: current.es, fr: current.fr },
    });
    setSyncing(false);
    // Drop the placeholder in case the model kept it beside the new text.
    const clean = (t?: { question: string; answer: string }) =>
      t ? { question: t.question, answer: t.answer.replace(ANSWER_PLACEHOLDER, "").trim() } : null;
    const en = clean(data?.en);
    const es = clean(data?.es);
    const fr = clean(data?.fr);
    if (status !== 200 || !data?.ok || !en?.answer || !es?.answer || !fr?.answer) {
      setError(data?.error ?? (translated ? "Couldn't translate the answer. Try again." : "Couldn't update Spanish and French. Try again."));
      return null;
    }
    const next = { en, es, fr };
    const notes = { es: data.es!.notes ?? [], fr: data.fr!.notes ?? [] };
    setDrafts(next);
    setEnBase(en);
    setSyncResult({ translated, enCorrected: !!data.en!.changed, notes });
    return { drafts: next, notes };
  }

  async function handlePublish() {
    if (!drafts || !prepared || !enBase) return;
    let toPublish = drafts;
    // An English edit not yet carried into Spanish and French: do it first.
    if (drafts.en.question !== enBase.question || drafts.en.answer !== enBase.answer) {
      const synced = await syncDrafts(kind, enBase, drafts);
      if (!synced) return;
      // Notes mean something didn't carry over cleanly: stop so they're read.
      if (synced.notes.es.length || synced.notes.fr.length) return;
      toPublish = synced.drafts;
    }
    setPhase("publishing");
    setError(null);
    const entries = {} as Record<FaqLanguage, FaqEntryDraft>;
    for (const lang of FAQ_LANGUAGES) {
      const g = gen[lang];
      if (g.status !== "done") return;
      entries[lang] = {
        ...g.result,
        // A written answer has no query_summary: the title is the question.
        ...(curated ? { meta_title: faqMetaTitle(null, toPublish[lang].question) } : {}),
        question: toPublish[lang].question,
        robust_query: prepared[lang].robust_query,
        answer_markdown: toPublish[lang].answer,
      };
    }
    const group = groupChoice === NEW_GROUP ? { names: groupNames } : { id: groupChoice };
    const { status, data } = await postJson<{ ok: boolean; slug?: string; error?: string }>("/api/admin/faq/publish", { entries, group });
    if (status !== 200 || !data?.ok || !data.slug) {
      setError(data?.error ?? "Couldn't publish. Nothing was saved. Try again.");
      setPhase("review");
      return;
    }
    setPublishedSlug(data.slug);
    setPhase("done");
  }

  /** Throw the draft away and go back to the question (nothing was saved). */
  function handleDiscard() {
    setConfirmDiscard(false);
    setDrafts(null);
    setPrepared(null);
    setEnBase(null);
    setSyncResult(null);
    setGroupNames(null);
    setGen(initialGen());
    resultsRef.current = {};
    setEditingAnswer(false);
    setError(null);
    setPhase("question");
    scheduleCheck(question);
  }

  const busy = phase === "preparing" || phase === "generating" || phase === "translating" || phase === "publishing" || syncing;
  const enEdited = !!drafts && !!enBase && (drafts.en.question !== enBase.question || drafts.en.answer !== enBase.answer);
  const chosenGroup = groups?.find((g) => g.id === groupChoice) ?? null;
  const groupReady = groupChoice === NEW_GROUP ? newGroupName.trim().length > 0 && newGroupName.trim().length <= MAX_GROUP_NAME_CHARS : !!chosenGroup;
  const groupLabel = groupChoice === NEW_GROUP ? (groupNames?.en ?? newGroupName.trim()) : (chosenGroup?.name_en ?? "");
  const groupNamesReady = !groupNames || FAQ_LANGUAGES.every((l) => groupNames[l].trim() && groupNames[l].trim().length <= MAX_GROUP_NAME_CHARS);
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
              placeholder={conversationId ? undefined : "e.g. What does the Bible say about forgiving others?"}
              autoFocus={!conversationId}
              className={`${adminInputClass} resize-y`}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Any language. It will be shaped into a public FAQ title and translated into English, Spanish and French.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="faq-group" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Group
            </label>
            <select
              id="faq-group"
              value={groupChoice}
              onChange={(e) => setGroupChoice(e.target.value)}
              disabled={phase === "preparing" || !groups}
              className={adminInputClass}
            >
              <option value="" disabled>
                {groups ? "Choose a group…" : groupsError ? "Couldn't load the groups" : "Loading groups…"}
              </option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name_en}
                </option>
              ))}
              <option value={NEW_GROUP}>New group…</option>
            </select>
            {groupChoice === NEW_GROUP && (
              <input
                aria-label="New group name (English)"
                placeholder="New group name in English, e.g. Salvation"
                value={newGroupName}
                maxLength={MAX_GROUP_NAME_CHARS}
                onChange={(e) => setNewGroupName(e.target.value)}
                disabled={phase === "preparing"}
                className={adminInputClass}
              />
            )}
            {groupChoice && (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                {chosenGroup?.kind === "doctrinal" ? (
                  <><span className="font-semibold text-foreground">Doctrinal question.</span> Answered from Brother Branham&apos;s sermons, like the existing FAQs.</>
                ) : (
                  <><span className="font-semibold text-foreground">Bible question.</span> Answered from Scripture, following Brother Branham&apos;s explanation, with sermon references at the end.{groupChoice === NEW_GROUP && " The group name is translated with the question."}</>
                )}
              </p>
            )}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Answer</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(
                [
                  ["generate", "Generate from the sermons"],
                  ["write", "Write it myself"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-400 ${
                    answerMode === value ? "bg-[var(--surface-base)] text-foreground shadow-sm" : "text-zinc-500 hover:text-foreground dark:text-zinc-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="faq-answer-mode"
                    value={value}
                    checked={answerMode === value}
                    onChange={() => setAnswerMode(value)}
                    disabled={phase === "preparing"}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {answerMode === "write" ? (
            <div className="space-y-1.5">
              <label htmlFor="faq-own-answer" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                English answer
              </label>
              <textarea
                id="faq-own-answer"
                rows={10}
                value={ownAnswer}
                maxLength={MAX_ANSWER_CHARS}
                onChange={(e) => setOwnAnswer(e.target.value)}
                disabled={phase === "preparing"}
                placeholder={"Markdown. Cite sermons the usual way, e.g. [THE GODHEAD EXPLAINED — 61-0425B: ¶122–¶126]"}
                className={`${adminInputClass} resize-y font-mono text-xs`}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Spelling and grammar are corrected, then it&apos;s written into Spanish and French with each citation matched to that translation&apos;s sermon. You review all three before publishing.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="faq-guidance" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Guidance for the answer <span className="font-normal">(optional)</span>
              </label>
              <textarea
                id="faq-guidance"
                rows={3}
                value={guidance}
                maxLength={MAX_GUIDANCE_CHARS}
                onChange={(e) => setGuidance(e.target.value)}
                disabled={phase === "preparing"}
                placeholder="e.g. Focus on the new birth as a real experience, not church membership. Look at where he ties it to the Holy Spirit baptism."
                className={`${adminInputClass} resize-y`}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Steers what the answer looks for and emphasises, in all three languages. It only states what the sermons support, and your notes never appear in the answer. Not saved.
              </p>
            </div>
          )}

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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {answerMode === "write" ? "Translating takes about 30 seconds." : "Generating takes about 2 minutes (three answers)."}
            </p>
            <button
              type="button"
              onClick={handlePrepare}
              disabled={phase === "preparing" || check.status !== "ok" || !groupReady || (answerMode === "write" && !ownAnswer.trim())}
              className={adminPrimaryButtonClass}
            >
              {phase === "preparing" ? "Preparing…" : answerMode === "write" ? "Translate FAQ" : "Generate FAQ"}
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
                        <button type="button" onClick={() => runGeneration(prepared, lang, kind)} className="font-medium text-foreground underline">
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

      {phase === "translating" && prepared && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Proofreading <span className="font-medium text-foreground">{prepared.en.question}</span> and writing it in Spanish and French. Keep this window open.
        </p>
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

          {enEdited && enBase && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200">
              <span>You&apos;ve edited the English. Spanish and French don&apos;t include it yet; publishing updates them first.</span>
              <button type="button" onClick={() => void syncDrafts(kind, enBase, drafts)} disabled={syncing || phase === "publishing"} className={adminSecondaryButtonClass}>
                {syncing ? "Updating…" : "Update Spanish & French"}
              </button>
            </div>
          )}
          {syncResult && !syncing && (
            <div className="space-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
              <p>
                {syncResult.translated ? "Written in Spanish and French" : "Spanish and French updated"}
                {syncResult.enCorrected ? ", and the English spelling and grammar were corrected" : ""}.{" "}
                {syncResult.notes.es.length || syncResult.notes.fr.length ? "Read the notes below and check the drafts, then publish." : "Check them before publishing."}
              </p>
              {(["es", "fr"] as const).flatMap((l) => syncResult.notes[l].map((n, i) => (
                <p key={`${l}${i}`} className="text-amber-700 dark:text-amber-400">{LANG_LABEL[l]}: {n}</p>
              )))}
            </div>
          )}

          {groupNames ? (
            <div className="space-y-1.5">
              <label htmlFor="faq-review-group" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                New group name ({LANG_LABEL[tab]})
              </label>
              <input
                id="faq-review-group"
                value={groupNames[tab]}
                maxLength={MAX_GROUP_NAME_CHARS}
                onChange={(e) => setGroupNames({ ...groupNames, [tab]: e.target.value })}
                disabled={phase === "publishing"}
                className={adminInputClass}
              />
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Group: <span className="font-medium text-foreground">{groupLabel}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="faq-review-question" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Question ({LANG_LABEL[tab]})
            </label>
            <input
              id="faq-review-question"
              value={drafts[tab].question}
              onChange={(e) => setDrafts({ ...drafts, [tab]: { ...drafts[tab], question: e.target.value } })}
              disabled={phase === "publishing" || syncing}
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
                disabled={syncing}
                className={`${adminInputClass} resize-y font-mono text-xs`}
              />
            ) : (
              <FaqAnswerPreview markdown={drafts[tab].answer} language={tab} />
            )}
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          {curated && <p className="text-xs text-zinc-500 dark:text-zinc-400">Written answer: the page&apos;s passages panel will be empty.</p>}

          {confirmDiscard ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
              <span>Discard this draft in all three languages? Nothing has been published.</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setConfirmDiscard(false)} className={adminSecondaryButtonClass}>Keep it</button>
                <button type="button" onClick={handleDiscard} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                  Discard draft
                </button>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={phase === "publishing" || syncing}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Discard draft
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={phase === "publishing" || syncing || FAQ_LANGUAGES.some((l) => !drafts[l].question.trim() || !drafts[l].answer.trim()) || !currentSlug || !groupNamesReady}
                className={adminPrimaryButtonClass}
              >
                {phase === "publishing" ? "Publishing…" : syncing ? "Updating Spanish & French…" : enEdited ? "Update Spanish & French and publish" : "Publish"}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "done" && publishedSlug && drafts && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Published in all three languages, in <span className="font-medium text-foreground">{groupLabel}</span>.
          </p>
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
