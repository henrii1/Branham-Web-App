/**
 * Server-only: write one day's Family Altar devotional with the Model API's
 * devotional mode (POST /api/chat, response_mode: "devotional"). Reads
 * MODEL_API_BASE_URL / CHAT_API_BEARER_KEY — never import into client code.
 */

import { processSSEStream } from "@/lib/sse/parser";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import type { KjvPassage } from "./kjv";
import type { AltarLanguage } from "./types";

export interface GeneratedDevotional {
  title: string;
  reflection_markdown: string;
  sermon_quotes_markdown: string | null;
  discussion_questions: string[];
  prayer_intro: string | null;
  prayer_points: string[];
  sermon_references: string[];
  answer_markdown: string;
  rag_context: string;
}

export class DevotionalError extends Error {}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export async function generateDevotional(
  passage: KjvPassage,
  language: AltarLanguage,
  day: string,
): Promise<GeneratedDevotional> {
  const base = process.env.MODEL_API_BASE_URL?.replace(/\/$/, "");
  const key = process.env.CHAT_API_BEARER_KEY;
  if (!base || !key) throw new DevotionalError("Model API is not configured.");

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      conversation_id: `altar-${day}-${language}-${crypto.randomUUID().slice(0, 8)}`,
      // Format required by devotional mode: "<reference> (<version>): <verse text>".
      query: `${passage.reference} (KJV): ${passage.text}`,
      user_language: language,
      response_mode: "devotional",
    }),
  });
  if (!res.ok || !res.body) throw new DevotionalError(`The devotional service returned ${res.status}.`);

  let ragContext = "";
  let final: { mode: string; answer: string; devotional?: unknown; parseError?: string | null } | null = null;
  let streamError: string | null = null;
  await processSSEStream(res.body.getReader(), (event) => {
    if (event.type === "rag") ragContext = event.ragContext ?? "";
    else if (event.type === "final") final = event;
    else if (event.type === "error") streamError = event.answer || "error";
  });

  const done = final as { mode: string; answer: string; devotional?: unknown; parseError?: string | null } | null;
  if (streamError || !done) throw new DevotionalError("The devotional didn't finish. Try again.");
  if (done.mode !== "devotional" || !done.devotional || typeof done.devotional !== "object") {
    throw new DevotionalError(
      done.parseError ? `The devotional came back incomplete (${done.parseError}). Try again.` : "The devotional came back incomplete. Try again.",
    );
  }

  const d = done.devotional as Record<string, unknown>;
  const title = str(d.title);
  const reflection = str(d.reflection_markdown);
  const questions = strings(d.discussion_questions);
  const points = strings(d.prayer_points);
  if (!title || !reflection || questions.length === 0 || points.length === 0) {
    throw new DevotionalError("The devotional came back incomplete. Try again.");
  }

  return {
    title,
    reflection_markdown: reflection,
    sermon_quotes_markdown: str(d.sermon_quotes_markdown),
    discussion_questions: questions,
    prayer_intro: str(d.prayer_intro),
    prayer_points: points,
    sermon_references: strings(d.references),
    answer_markdown: done.answer ?? "",
    rag_context: postprocessRag(ragContext),
  };
}
