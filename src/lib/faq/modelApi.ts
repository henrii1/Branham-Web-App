/**
 * Server-only calls to the Branham LLM API for the admin Add-to-FAQ flow.
 * Reads MODEL_API_BASE_URL / CHAT_API_BEARER_KEY — never import this into
 * client code (the bearer key must not reach the browser bundle).
 */

import { processSSEStream } from "@/lib/sse/parser";
import {
  cleanFaqAnswer,
  cleanFaqRag,
  faqMetaDescription,
  faqMetaTitle,
  FAQ_LANGUAGES,
  type FaqLanguage,
} from "./entry";

export interface FaqPreparedQuestion {
  question: string;
  robust_query: string;
}

export interface FaqGeneratedAnswer {
  answer_markdown: string;
  rag_context: string;
  conversation_summary: string | null;
  meta_title: string;
  meta_description: string;
}

export class ModelApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function apiConfig() {
  const base = process.env.MODEL_API_BASE_URL?.replace(/\/$/, "");
  const key = process.env.CHAT_API_BEARER_KEY;
  if (!base || !key) throw new ModelApiError("Model API is not configured.", 500);
  return { base, key };
}

/**
 * POST /api/faq/translate — shapes the admin's question into a public FAQ
 * title + robust_query in English, and translates both into es/fr using the
 * official translations' terminology.
 */
export async function prepareFaqQuestion(
  question: string,
): Promise<Record<FaqLanguage, FaqPreparedQuestion>> {
  const { base, key } = apiConfig();
  const res = await fetch(`${base}/api/faq/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ question }),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    results?: Record<string, FaqPreparedQuestion>;
    error?: string;
  } | null;

  if (res.status === 400) {
    throw new ModelApiError("That question can't be used. Check its length and try again.", 400);
  }
  if (!res.ok || !data?.ok || !data.results) {
    throw new ModelApiError("Couldn't prepare the question. Try again.");
  }
  for (const lang of FAQ_LANGUAGES) {
    const r = data.results[lang];
    if (!r?.question?.trim() || !r?.robust_query?.trim()) {
      throw new ModelApiError("Couldn't prepare the question. Try again.");
    }
  }
  return data.results as Record<FaqLanguage, FaqPreparedQuestion>;
}

/**
 * POST /api/chat for one language, read to the end, and return the fields
 * an FAQ row needs, cleaned the same way scripts/seed-seo.ts cleaned them.
 */
export async function generateFaqAnswer(
  robustQuery: string,
  question: string,
  language: FaqLanguage,
): Promise<FaqGeneratedAnswer> {
  const { base, key } = apiConfig();
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      conversation_id: `faq-${crypto.randomUUID()}`,
      query: robustQuery,
      user_language: language,
    }),
  });
  if (!res.ok || !res.body) {
    throw new ModelApiError(`The answer service returned ${res.status}.`);
  }

  let ragContext = "";
  let final: { mode: string; answer: string; conversationSummary: string | null; querySummary: string | null } | null = null;
  let streamError: string | null = null;

  await processSSEStream(res.body.getReader(), (event) => {
    if (event.type === "rag") ragContext = event.ragContext ?? "";
    else if (event.type === "final") final = event;
    else if (event.type === "error") streamError = event.answer || "error";
  });

  const done = final as { mode: string; answer: string; conversationSummary: string | null; querySummary: string | null } | null;
  if (streamError || !done) {
    throw new ModelApiError("The answer didn't finish. Try this language again.");
  }
  if (done.mode === "refusal" || !done.answer?.trim()) {
    throw new ModelApiError(
      "The assistant couldn't answer this question from the sermons. Reword the question and try again.",
      422,
    );
  }

  const answer = cleanFaqAnswer(done.answer);
  return {
    answer_markdown: answer,
    rag_context: cleanFaqRag(ragContext),
    conversation_summary: done.conversationSummary,
    // The API's query_summary is English even for es/fr answers, so the
    // es/fr pages use their own (localized) question as the title.
    meta_title: faqMetaTitle(language === "en" ? done.querySummary : null, question),
    meta_description: faqMetaDescription(answer),
  };
}
