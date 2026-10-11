"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminDialog,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  postJson,
} from "@/components/admin/faq/AdminDialog";
import { addDays, mondayOf } from "@/lib/altar/week";
import type { AltarStatus, FamilyAltarDay } from "@/lib/altar/types";

interface WeekState {
  rows: FamilyAltarDay[];
  defaults: Record<string, string>;
}

const STATUS_STYLE: Record<AltarStatus | "none", string> = {
  ready: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  generating: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  none: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

/**
 * Admin-only tools on /altar: week status, generate missing days (this week
 * and next), and for the selected day: edit text, regenerate, change verse.
 */
export function AltarAdmin({
  day,
  row,
  today,
  onChanged,
}: {
  day: string;
  row: FamilyAltarDay | null;
  /** Called after a generate or an edit, so the page reloads what it shows. */
  onChanged?: () => void;
  /** The admin's local date. Past days can be read and edited, not generated. */
  today: string;
}) {
  const isPast = day < today;
  const router = useRouter();
  const [weeks, setWeeks] = useState<Record<string, WeekState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [verse, setVerse] = useState("");

  // Always the real this/next week, whichever week the page is showing.
  const thisWeek = mondayOf(today);
  const nextWeek = addDays(thisWeek, 7);

  const fetchWeek = useCallback(
    (weekStart: string) =>
      postJson<{ ok: boolean; rows: FamilyAltarDay[]; defaults: Record<string, string> }>("/api/admin/altar/week", { week_start: weekStart }).then(
        ({ data }) => (data?.ok ? ([weekStart, { rows: data.rows, defaults: data.defaults }] as const) : null),
      ),
    [],
  );

  const loadWeek = useCallback(
    async (weekStart: string) => {
      const entry = await fetchWeek(weekStart);
      if (entry) setWeeks((w) => ({ ...w, [entry[0]]: entry[1] }));
    },
    [fetchWeek],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchWeek(thisWeek), fetchWeek(nextWeek)]).then((entries) => {
      if (cancelled) return;
      setWeeks((w) => ({ ...w, ...Object.fromEntries(entries.filter((e) => e !== null)) }));
    });
    return () => {
      cancelled = true;
    };
  }, [fetchWeek, thisWeek, nextWeek]);

  async function generateDays(days: string[], reference?: string) {
    setMessage(null);
    let ok = 0;
    const failures: string[] = [];
    for (const [i, d] of days.entries()) {
      setBusy(days.length > 1 ? `Generating ${i + 1} of ${days.length} (${d})… about 30s each` : `Generating ${d}… about 30 seconds`);
      const { data } = await postJson<{ ok: boolean; result?: { error?: string; keptPrevious?: boolean }; error?: string }>(
        "/api/admin/altar/generate-day",
        reference ? { day: d, reference } : { day: d },
      );
      if (data?.ok) ok++;
      else failures.push(`${d}: ${data?.result?.error ?? data?.error ?? "failed"}${data?.result?.keptPrevious ? " (the published version was kept)" : ""}`);
    }
    setBusy(null);
    setMessage(failures.length ? { kind: "error", text: `${ok} generated. ${failures.join(" · ")}` } : { kind: "ok", text: `${ok} day${ok === 1 ? "" : "s"} generated.` });
    await Promise.all([loadWeek(thisWeek), loadWeek(nextWeek)]);
    onChanged?.();
    router.refresh();
  }

  const missing = (weekStart: string, onlyFromDay: string = today) => {
    const w = weeks[weekStart];
    if (!w) return [];
    const ready = new Set(w.rows.filter((r) => r.status === "ready").map((r) => r.day));
    return Object.keys(w.defaults).filter((d) => !ready.has(d) && d >= onlyFromDay);
  };

  const renderWeekRow = (label: string, weekStart: string) => {
    const w = weeks[weekStart];
    const todo = missing(weekStart);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
        {w ? (
          Object.keys(w.defaults).map((d) => {
            const r = w.rows.find((x) => x.day === d);
            const st: AltarStatus | "none" = r?.status ?? "none";
            return (
              <span key={d} title={`${d}: ${r?.scripture_ref ?? w.defaults[d]}${r?.error ? ` — ${r.error}` : ""}`} className={`rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${STATUS_STYLE[st]}`}>
                {d.slice(8)}
              </span>
            );
          })
        ) : (
          <span className="text-xs text-zinc-400">Loading…</span>
        )}
        {w && todo.length > 0 && (
          <button type="button" disabled={!!busy} onClick={() => generateDays(todo)} className="text-xs font-medium text-foreground underline disabled:opacity-40">
            Generate {todo.length} missing
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-[var(--surface-soft)] p-3 text-sm dark:border-zinc-700">
      <div className="flex flex-col gap-1.5">
        {renderWeekRow("This week", thisWeek)}
        {renderWeekRow("Next week", nextWeek)}
        <p className="text-[11px] text-zinc-500">Green: published · Red: failed (hover for the reason) · Grey: not generated yet. Missing days generate automatically every day at 12:00 UTC.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">This day:</span>
        <button type="button" disabled={!row || !!busy} onClick={() => setEditing(true)} className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700">
          Edit text
        </button>
        <button type="button" disabled={!!busy || isPast} onClick={() => generateDays([day])} className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700">
          {row ? "Regenerate" : "Generate"}
        </button>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (verse.trim()) void generateDays([day], verse.trim());
          }}
        >
          <label htmlFor="altar-verse" className="sr-only">New verse reference</label>
          <input
            id="altar-verse"
            value={verse}
            onChange={(e) => setVerse(e.target.value)}
            placeholder={row?.scripture_ref ?? weeks[thisWeek]?.defaults[day] ?? "e.g. Psalm 23:1"}
            disabled={isPast}
            className="w-40 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
          />
          <button type="submit" disabled={!!busy || !verse.trim() || isPast} className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700">
            Change verse
          </button>
        </form>
      </div>

      {isPast && (
        <p className="text-[11px] text-zinc-500">This day has passed, so it can&apos;t be generated or given a new verse. You can still edit its text.</p>
      )}
      {busy && <p className="text-xs text-blue-700 dark:text-blue-300" role="status">{busy} Keep this page open.</p>}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
          {message.text}
        </p>
      )}

      {editing && row && <AltarEditModal row={row} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged?.(); router.refresh(); }} />}
    </div>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function AltarEditModal({ row, onClose, onSaved }: { row: FamilyAltarDay; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(row.title ?? "");
  const [reflection, setReflection] = useState(row.reflection_markdown ?? "");
  const [quotes, setQuotes] = useState(row.sermon_quotes_markdown ?? "");
  const [questions, setQuestions] = useState(row.discussion_questions.join("\n"));
  const [prayerIntro, setPrayerIntro] = useState(row.prayer_intro ?? "");
  const [points, setPoints] = useState(row.prayer_points.join("\n"));
  const [refs, setRefs] = useState(row.sermon_references.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { status, data } = await postJson<{ ok: boolean; error?: string }>("/api/admin/altar/update", {
      day: row.day,
      language: row.language,
      fields: {
        title,
        reflection_markdown: reflection,
        sermon_quotes_markdown: quotes,
        discussion_questions: lines(questions),
        prayer_intro: prayerIntro,
        prayer_points: lines(points),
        sermon_references: lines(refs).map((r) => r.replace(/^\[|\]$/g, "")),
      },
    });
    if (status !== 200 || !data?.ok) {
      setError(data?.error === "invalid_request" ? "Title, reflection, a question and a prayer point are required." : (data?.error ?? "Couldn't save. Your edit was not applied."));
      setSaving(false);
      return;
    }
    onSaved();
  }

  const field = (id: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      {el}
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );

  return (
    <AdminDialog title={`Edit devotional (${row.day})`} onClose={onClose} closeDisabled={saving}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {field("ae-title", "Title", <input id="ae-title" value={title} onChange={(e) => setTitle(e.target.value)} className={adminInputClass} />)}
        {field("ae-reflection", "Reflection", <textarea id="ae-reflection" rows={10} value={reflection} onChange={(e) => setReflection(e.target.value)} className={`${adminInputClass} font-mono text-xs`} />, "Keep citations in bracket form, e.g. Evidence: [SERMON TITLE — 63-0324E: ¶12–¶14].")}
        {field("ae-quotes", "From the Sermons", <textarea id="ae-quotes" rows={6} value={quotes} onChange={(e) => setQuotes(e.target.value)} className={`${adminInputClass} font-mono text-xs`} />, "Each quote as a > blockquote ending with its citation. Leave empty to hide the section.")}
        {field("ae-questions", "Talk Together (one question per line)", <textarea id="ae-questions" rows={4} value={questions} onChange={(e) => setQuestions(e.target.value)} className={adminInputClass} />)}
        {field("ae-intro", "Prayer introduction", <input id="ae-intro" value={prayerIntro} onChange={(e) => setPrayerIntro(e.target.value)} className={adminInputClass} />)}
        {field("ae-points", "Prayer points (one per line)", <textarea id="ae-points" rows={5} value={points} onChange={(e) => setPoints(e.target.value)} className={adminInputClass} />)}
        {field("ae-refs", "References (one per line)", <textarea id="ae-refs" rows={3} value={refs} onChange={(e) => setRefs(e.target.value)} className={`${adminInputClass} font-mono text-xs`} />, "Format: SERMON TITLE — 63-0324E: ¶12–¶14")}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className={adminSecondaryButtonClass}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} className={adminPrimaryButtonClass}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </AdminDialog>
  );
}
