/**
 * Retry script for failed/incomplete SEO queries.
 * Usage:  npx tsx scripts/seed-seo-retry.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = value;
}

const API_URL = "http://127.0.0.1:8010/api/chat";
const BEARER_KEY = process.env.CHAT_API_BEARER_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface QueryPair { shortQuery: string; robustQuery: string; }

const RETRY_QUERIES: QueryPair[] = [
  {
    shortQuery: "What did Brother Branham teach about the mark of the beast?",
    robustQuery: "Show what Brother Branham taught about the mark of the beast from his sermons. Search for where he explained the beast, the image, denominational systems, false worship, Rome, and end-time deception. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the antichrist?",
    robustQuery: "Show what Brother Branham taught about the antichrist from his sermons. Search for where he explained the antichrist spirit, the false church, false anointing, and how the antichrist differs from Christ. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about hell?",
    robustQuery: "Show what Brother Branham taught about hell from his sermons. Search for where he explained punishment, the lake of fire, whether hell is eternal, and whether the lost are destroyed or tormented forever. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the serpent in Eden?",
    robustQuery: "Show what Brother Branham taught from his sermons about the serpent in Eden. Search for where he described what the serpent was before the curse, how it could reason or speak, and how he connected it to the fall and Cain. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the 144,000?",
    robustQuery: "Show what Brother Branham taught about the 144,000 from his sermons. Search for where he explained whether they are Jews, whether they are part of the Bride, when they are sealed, and how they fit in Revelation. Include the clearest sermon references.",
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[?!.,;:'"()\[\]{}]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const ANSWER_PREFIX = /^(?:#{1,6}\s*)?(?:\*{1,2})?Answer:?(?:\*{1,2})?:?\s*/i;
function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "").trimStart();
}

function stripMarkdownToPlain(md: string): string {
  return md.replace(/#{1,6}\s+/g, "").replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "").replace(/^---$/gm, "").replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();
}

function generateMetaDescription(answerMarkdown: string): string {
  const plain = stripMarkdownToPlain(answerMarkdown);
  if (plain.length <= 155) return plain;
  const truncated = plain.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

interface SeedResult {
  answer: string; ragContext: string;
  conversationSummary: string | null; querySummary: string | null;
}

async function queryApi(robustQuery: string): Promise<SeedResult> {
  const conversationId = crypto.randomUUID();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BEARER_KEY}` },
    body: JSON.stringify({ conversation_id: conversationId, query: robustQuery, user_language: "en" }),
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  if (!response.body) throw new Error("No body");

  let answer = "", ragContext = "";
  let conversationSummary: string | null = null, querySummary: string | null = null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", eventType = "", dataLines: string[] = [];

  function flush() {
    if (!eventType || dataLines.length === 0) { eventType = ""; dataLines = []; return; }
    try {
      const data = JSON.parse(dataLines.join("\n"));
      if (eventType === "rag") ragContext = data.rag_context ?? "";
      else if (eventType === "final") {
        answer = data.answer ?? "";
        conversationSummary = data.conversation_summary ?? null;
        querySummary = data.query_summary ?? null;
      } else if (eventType === "error") throw new Error(`API error: ${data.answer}`);
    } catch (e) { if (e instanceof Error && e.message.startsWith("API error")) throw e; }
    eventType = ""; dataLines = [];
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n?/g, "\n");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        else if (line === "") flush();
      }
    }
    flush();
  } finally { reader.releaseLock(); }

  if (!answer) throw new Error("No answer");
  return { answer, ragContext, conversationSummary, querySummary };
}

async function main() {
  console.log(`\nRetrying ${RETRY_QUERIES.length} failed queries...\n`);
  for (let i = 0; i < RETRY_QUERIES.length; i++) {
    const { shortQuery, robustQuery } = RETRY_QUERIES[i];
    const slug = slugify(shortQuery);
    console.log(`[${i + 1}/${RETRY_QUERIES.length}] ${shortQuery}`);

    let result: SeedResult | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { result = await queryApi(robustQuery); break; }
      catch (e) {
        console.log(`  attempt ${attempt}/3 failed: ${e instanceof Error ? e.message : e}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
    if (!result) { console.log(`  FAILED\n`); continue; }

    const cleanAnswer = postprocessChatResponse(stripAnswerPrefix(result.answer));
    const cleanRag = postprocessRag(result.ragContext);
    const metaTitle = result.querySummary
      ? `${result.querySummary} | Branham Sermons AI`
      : `${shortQuery} | Branham Sermons AI`;

    const { error } = await supabase.from("seo_cache").upsert({
      slug, question: shortQuery, robust_query: robustQuery,
      answer_markdown: cleanAnswer, rag_context: cleanRag,
      conversation_summary: result.conversationSummary,
      language: "en", published: true,
      meta_title: metaTitle, meta_description: generateMetaDescription(cleanAnswer),
    }, { onConflict: "slug" });

    if (error) console.log(`  DB ERROR: ${error.message}\n`);
    else console.log(`  OK (answer: ${cleanAnswer.length} chars, rag: ${cleanRag.length} chars)\n`);

    if (i < RETRY_QUERIES.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
  console.log("\nDone!");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
