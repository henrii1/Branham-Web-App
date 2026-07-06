/**
 * Populates seo_cache with Spanish and French versions of all published EN rows.
 * Calls the Model API directly with each row's robust_query field.
 *
 * Run: CHAT_API_BEARER_KEY=... MODEL_API_BASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/populate-faq-translations.ts
 *
 * Safe to re-run: skips rows that already exist (idempotent).
 */

import { createClient } from "@supabase/supabase-js";

const MODEL_API_BASE_URL = process.env.MODEL_API_BASE_URL;
const CHAT_API_BEARER_KEY = process.env.CHAT_API_BEARER_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MODEL_API_BASE_URL || !CHAT_API_BEARER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars: MODEL_API_BASE_URL, CHAT_API_BEARER_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_LANGUAGES = ["es", "fr"] as const;

async function fetchFinalAnswer(query: string, language: string): Promise<string> {
  const response = await fetch(`${MODEL_API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHAT_API_BEARER_KEY}`,
    },
    body: JSON.stringify({ query, user_language: language }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalAnswer: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let eventType = "";
    let dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
        dataLines = [];
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line === "" && eventType && dataLines.length > 0) {
        const raw = dataLines.join("\n");
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (eventType === "final" && typeof parsed.answer === "string") {
            finalAnswer = parsed.answer;
          }
        } catch {
          // malformed data line, skip
        }
        eventType = "";
        dataLines = [];
      }
    }
  }

  if (!finalAnswer) throw new Error("No 'final' event with answer received from API");
  return finalAnswer;
}

async function main() {
  // Fetch all published EN rows.
  const { data: enRows, error } = await supabase
    .from("seo_cache")
    .select("slug, question, robust_query")
    .eq("published", true)
    .eq("language", "en")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!enRows || enRows.length === 0) {
    console.log("No published EN rows found.");
    return;
  }

  console.log(`Found ${enRows.length} EN rows. Generating ES and FR versions...\n`);

  for (const row of enRows) {
    for (const lang of TARGET_LANGUAGES) {
      // Check if this (slug, lang) already exists.
      const { data: existing } = await supabase
        .from("seo_cache")
        .select("slug")
        .eq("slug", row.slug)
        .eq("language", lang)
        .maybeSingle();

      if (existing) {
        console.log(`  SKIP  [${lang}] ${row.slug}`);
        continue;
      }

      try {
        process.stdout.write(`  GEN   [${lang}] ${row.slug} ... `);
        const answer = await fetchFinalAnswer(row.robust_query, lang);

        const { error: insertError } = await supabase.from("seo_cache").insert({
          slug: row.slug,
          language: lang,
          question: row.question,
          robust_query: row.robust_query,
          answer_markdown: answer,
          published: true,
        });

        if (insertError) throw insertError;
        console.log("done");
      } catch (err) {
        console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});