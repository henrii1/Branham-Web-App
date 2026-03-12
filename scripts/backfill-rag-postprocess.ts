/**
 * Reprocesses stored RAG context using the current postprocess pipeline,
 * then writes the cleaned text back to the database.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-rag-postprocess.ts
 *   node --experimental-strip-types scripts/backfill-rag-postprocess.ts --dry-run
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IS_DRY_RUN = process.argv.includes("--dry-run");
const PAGE_SIZE = 200;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { postprocessRag } = await import(
  new URL("../src/lib/markdown/ragPostprocess.ts", import.meta.url).href,
);

type TableStats = {
  scanned: number;
  changed: number;
  updated: number;
};

async function backfillSeoCache(): Promise<TableStats> {
  const stats: TableStats = { scanned: 0, changed: 0, updated: 0 };
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("seo_cache")
      .select("slug, rag_context")
      .order("slug", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      stats.scanned += 1;
      const cleaned = postprocessRag(row.rag_context);
      if (cleaned === row.rag_context) continue;

      stats.changed += 1;
      if (!IS_DRY_RUN) {
        const { error: updateError } = await supabase
          .from("seo_cache")
          .update({ rag_context: cleaned })
          .eq("slug", row.slug);
        if (updateError) throw updateError;
        stats.updated += 1;
      }
    }

    from += PAGE_SIZE;
  }

  return stats;
}

async function backfillConversationRag(): Promise<TableStats> {
  const stats: TableStats = { scanned: 0, changed: 0, updated: 0 };
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("conversation_rag")
      .select("conversation_id, rag_context")
      .order("conversation_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      stats.scanned += 1;
      const cleaned = postprocessRag(row.rag_context);
      if (cleaned === row.rag_context) continue;

      stats.changed += 1;
      if (!IS_DRY_RUN) {
        const { error: updateError } = await supabase
          .from("conversation_rag")
          .update({ rag_context: cleaned })
          .eq("conversation_id", row.conversation_id);
        if (updateError) throw updateError;
        stats.updated += 1;
      }
    }

    from += PAGE_SIZE;
  }

  return stats;
}

function printStats(label: string, stats: TableStats) {
  console.log(
    `${label}: scanned=${stats.scanned}, changed=${stats.changed}, updated=${stats.updated}`,
  );
}

async function main() {
  console.log(
    IS_DRY_RUN
      ? "Running RAG backfill in dry-run mode."
      : "Running RAG backfill and updating DB rows.",
  );

  const seoStats = await backfillSeoCache();
  const conversationStats = await backfillConversationRag();

  printStats("seo_cache", seoStats);
  printStats("conversation_rag", conversationStats);

  const totalChanged = seoStats.changed + conversationStats.changed;
  const totalUpdated = seoStats.updated + conversationStats.updated;
  console.log(`total_changed=${totalChanged}, total_updated=${totalUpdated}`);
}

main().catch((error) => {
  console.error("RAG backfill failed.");
  console.error(error);
  process.exit(1);
});
