/**
 * SEO seed script — calls the Model API with each robust query,
 * parses the SSE response, and upserts into seo_cache.
 *
 * Usage:  npx tsx scripts/seed-seo.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { postprocessRag } from "@/lib/markdown/ragPostprocess";
import { postprocessChatResponse } from "@/lib/markdown/chatPostprocess";

// ── Load .env.local ──────────────────────────────────────────────────
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

// ── Config ───────────────────────────────────────────────────────────
const API_URL = "http://127.0.0.1:8010/api/chat";
const BEARER_KEY = process.env.CHAT_API_BEARER_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!BEARER_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Query pairs ──────────────────────────────────────────────────────
interface QueryPair {
  shortQuery: string;
  robustQuery: string;
}

const QUERIES: QueryPair[] = [
  {
    shortQuery: "What did Brother Branham teach about the serpent seed?",
    robustQuery: "Show what Brother Branham taught about the serpent seed from his sermons. Search for where he explained Eve, the serpent, Cain, the fall in Eden, and whether the original sin was sexual. Include the main sermon references and any clarifying biography context only if needed.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Godhead?",
    robustQuery: "Show what Brother Branham taught about the Godhead from his sermons. Search for where he spoke about Father, Son, and Holy Ghost, whether God is one, whether he rejected the Trinity, and how he explained the name of the Lord Jesus Christ. Include key sermon references and only add biography context if needed.",
  },
  {
    shortQuery: "How did Brother Branham teach baptism in Jesus Name?",
    robustQuery: "Show what Brother Branham taught about water baptism from his sermons. Search for where he explained baptism in the Name of the Lord Jesus Christ, why he rejected titles-only baptism, whether rebaptism was necessary, and how he used Acts 2:38 and Acts 19. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Seven Church Ages?",
    robustQuery: "Show what Brother Branham taught about the Seven Church Ages from his sermons and teachings. Search for the seven ages, the seven messengers, the spirit of each age, and how he connected Revelation 2 and 3 to church history. Include the clearest sermon and book references.",
  },
  {
    shortQuery: "Did Brother Branham say he was Malachi 4?",
    robustQuery: "Show what Brother Branham taught about Malachi 4 from his sermons. Search for where he spoke about Elijah coming before the great and dreadful day of the Lord, turning the hearts, and whether he applied this prophecy to his own ministry. Include the strongest sermon references and biography context only where necessary.",
  },
  {
    shortQuery: "Did Brother Branham say he was Revelation 10:7?",
    robustQuery: "Show what Brother Branham taught about Revelation 10:7 from his sermons. Search for where he spoke about the seventh angel, the finishing of the mystery of God, and whether he connected this scripture to his ministry and message. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the rapture?",
    robustQuery: "Show what Brother Branham taught about the rapture from his sermons. Search for where he explained the Bride, the catching away, the shout, voice, trumpet, readiness, and the faith needed for translation. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Bride?",
    robustQuery: "Show what Brother Branham taught about the Bride of Christ from his sermons. Search for where he explained the elect, the true Church, separation from denomination, and the Bride receiving the Word for the hour. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about marriage and divorce?",
    robustQuery: "Show what Brother Branham taught about marriage and divorce from his sermons. Search for where he explained divorce, remarriage, adultery, and the responsibilities of husband and wife, especially in the Marriage And Divorce message and related sermons. Include the main sermon references.",
  },
  {
    shortQuery: "Can a divorced person remarry according to Brother Branham?",
    robustQuery: "Show what Brother Branham taught from his sermons about whether a divorced person can remarry. Search for where he spoke about exceptions, adultery, innocence, remarriage for men and women, and how he applied Matthew 19 and 1 Corinthians 7. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham say is the evidence of the Holy Ghost?",
    robustQuery: "Show what Brother Branham taught about the evidence of the Holy Ghost from his sermons. Search for where he explained whether the evidence is speaking in tongues, a changed life, the new birth, receiving the Word, or revelation of Christ. Include the main sermon references.",
  },
  {
    shortQuery: "Did Brother Branham say tongues is the evidence of the Holy Ghost?",
    robustQuery: "Show what Brother Branham taught from his sermons about speaking in tongues and the evidence of the Holy Ghost. Search for where he corrected Pentecostal teaching on tongues and explained what the real evidence is. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about women preachers?",
    robustQuery: "Show what Brother Branham taught about women preaching from his sermons. Search for where he spoke about women pastors, women teaching men, women speaking in church, and the order of the church. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about women's hair and dress?",
    robustQuery: "Show what Brother Branham taught about women's hair, dress, modesty, makeup, and holiness from his sermons. Search for where he explained long hair, women wearing pants, outward appearance, and how these things relate to Scripture. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about predestination?",
    robustQuery: "Show what Brother Branham taught about predestination from his sermons. Search for where he explained election, foreknowledge, seed, the Lamb's Book of Life, and how the Bride was chosen in Christ. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham mean by the seed and the shuck?",
    robustQuery: "Show what Brother Branham taught about the seed and the shuck from his sermons. Search for where he compared the Word, denominational systems, and the Bride to seed, husk, and life coming to maturity. Include the clearest sermon references.",
  },
  {
    shortQuery: "Why did Brother Branham preach against denomination?",
    robustQuery: "Show what Brother Branham taught from his sermons about denomination. Search for where he explained why he believed denominational systems were wrong, how they differ from the true Church, and how organization can hinder the Word. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about communion?",
    robustQuery: "Show what Brother Branham taught about communion from his sermons. Search for where he explained the Lord's Supper, self-examination, unworthy partaking, and how believers should approach communion. Include the main sermon references.",
  },
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
  {
    shortQuery: "What did Brother Branham teach about his ministry and calling?",
    robustQuery: "Show what Brother Branham taught from his sermons about his own ministry and calling. Search for where he spoke about being a prophet, the end-time messenger, Malachi 4, Revelation 10:7, Luke 17:30, and the Laodicean church age messenger. Include key sermon references and biography context where needed.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Seven Thunders?",
    robustQuery: "Show what Brother Branham taught about the Seven Thunders from his sermons. Search for where he connected the Seven Thunders to Revelation 10, the Seven Seals, the Seventh Seal, hidden mysteries, and faith for the rapture. Include the clearest sermon references and note any places where he said the Thunders were revealed or not written. Include biography context only if needed.",
  },
  {
    shortQuery: "Was Brother Branham Oneness or not?",
    robustQuery: "Show from Brother Branham's sermons whether he should be understood as Oneness, anti-Trinitarian, or something different. Search for where he explained one God, Father Son and Holy Ghost, and baptism in the Name of the Lord Jesus Christ. Include the strongest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Seven Seals?",
    robustQuery: "Show what Brother Branham taught about the Seven Seals from his sermons. Search for where he explained each seal, the opening of the mysteries, the relation to Matthew 24, and how the seals connect to the Bride in the last days. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the foolish virgin?",
    robustQuery: "Show what Brother Branham taught about the foolish virgin from his sermons. Search for where he explained the wise and foolish virgins, tribulation, the new birth, and who misses the rapture but may still be saved. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the wise virgin?",
    robustQuery: "Show what Brother Branham taught about the wise virgin from his sermons. Search for where he explained the Bride, oil in the lamp, readiness, revelation, and what separates the wise virgin from the foolish virgin. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about holiness standards?",
    robustQuery: "Show what Brother Branham taught about holiness and Christian living from his sermons. Search for where he spoke about separation from the world, dress, conduct, modesty, entertainment, and sanctified living for men and women. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about ministers and tithing?",
    robustQuery: "Show what Brother Branham taught from his sermons about tithes, offerings, support for ministers, and the right attitude toward money in the ministry. Search for where he spoke about preacher salaries, church support, and giving. Include the main sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the cloud and the seven angels?",
    robustQuery: "Show what Brother Branham taught about the cloud and the seven angels from his sermons. Search for where he spoke about the Arizona cloud, the visitation of the angels, the commission connected with the Seals, and how he explained the supernatural sign. Include the strongest sermon references and biography context where needed.",
  },
  {
    shortQuery: "What did Brother Branham teach about the Laodicean church age?",
    robustQuery: "Show what Brother Branham taught about the Laodicean church age from his sermons. Search for where he explained the last church age, lukewarm religion, the messenger to Laodicea, and the condition of the end-time church. Include the clearest sermon references.",
  },
  {
    shortQuery: "What did Brother Branham teach about the gifts of the Spirit?",
    robustQuery: "Show what Brother Branham taught about the gifts of the Spirit from his sermons. Search for where he explained discernment, prophecy, tongues, healing, miracles, and how gifts should operate in order under the Holy Spirit. Include the main sermon references.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

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
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function generateMetaDescription(answerMarkdown: string): string {
  const plain = stripMarkdownToPlain(answerMarkdown);
  if (plain.length <= 155) return plain;
  const truncated = plain.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

// ── SSE stream parser (for the seed script) ──────────────────────────

interface SeedResult {
  answer: string;
  ragContext: string;
  conversationSummary: string | null;
  querySummary: string | null;
}

async function queryApi(robustQuery: string): Promise<SeedResult> {
  const conversationId = crypto.randomUUID();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BEARER_KEY}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      query: robustQuery,
      user_language: "en",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error("No response body from API");
  }

  let answer = "";
  let ragContext = "";
  let conversationSummary: string | null = null;
  let querySummary: string | null = null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];

  function flush() {
    if (!eventType || dataLines.length === 0) {
      eventType = "";
      dataLines = [];
      return;
    }
    try {
      const data = JSON.parse(dataLines.join("\n"));
      switch (eventType) {
        case "rag":
          ragContext = data.rag_context ?? "";
          break;
        case "final":
          answer = data.answer ?? "";
          conversationSummary = data.conversation_summary ?? null;
          querySummary = data.query_summary ?? null;
          break;
        case "error":
          throw new Error(`API error event: ${data.answer ?? "Unknown"}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("API error event:"))
        throw e;
    }
    eventType = "";
    dataLines = [];
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
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        } else if (line === "") {
          flush();
        }
      }
    }
    flush();
  } finally {
    reader.releaseLock();
  }

  if (!answer) {
    throw new Error("No answer received from API");
  }

  return { answer, ragContext, conversationSummary, querySummary };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeeding ${QUERIES.length} SEO queries...\n`);

  let succeeded = 0;
  let failed = 0;
  const errors: { idx: number; question: string; error: string }[] = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const { shortQuery, robustQuery } = QUERIES[i];
    const slug = slugify(shortQuery);
    console.log(`[${i + 1}/${QUERIES.length}] ${shortQuery}`);
    console.log(`  slug: ${slug}`);

    let result: SeedResult | null = null;
    let lastError = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await queryApi(robustQuery);
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.log(`  attempt ${attempt}/3 failed: ${lastError}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 5000 * attempt));
        }
      }
    }

    if (!result) {
      console.log(`  FAILED after 3 attempts\n`);
      failed++;
      errors.push({ idx: i + 1, question: shortQuery, error: lastError });
      continue;
    }

    const cleanAnswer = postprocessChatResponse(stripAnswerPrefix(result.answer));
    const cleanRag = postprocessRag(result.ragContext);
    const metaTitle = result.querySummary
      ? `${result.querySummary} | Branham Sermons AI`
      : `${shortQuery} | Branham Sermons AI`;
    const metaDescription = generateMetaDescription(cleanAnswer);

    const { error: dbError } = await supabase.from("seo_cache").upsert(
      {
        slug,
        question: shortQuery,
        robust_query: robustQuery,
        answer_markdown: cleanAnswer,
        rag_context: cleanRag,
        conversation_summary: result.conversationSummary,
        language: "en",
        published: true,
        meta_title: metaTitle,
        meta_description: metaDescription,
      },
      { onConflict: "slug" },
    );

    if (dbError) {
      console.log(`  DB ERROR: ${dbError.message}\n`);
      failed++;
      errors.push({ idx: i + 1, question: shortQuery, error: dbError.message });
    } else {
      console.log(`  OK (answer: ${cleanAnswer.length} chars, rag: ${cleanRag.length} chars)`);
      console.log(`  meta_title: ${metaTitle}\n`);
      succeeded++;
    }

    // Gentle delay between requests
    if (i < QUERIES.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! ${succeeded} succeeded, ${failed} failed.`);
  if (errors.length > 0) {
    console.log("\nFailed queries:");
    for (const e of errors) {
      console.log(`  ${e.idx}. ${e.question}: ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
