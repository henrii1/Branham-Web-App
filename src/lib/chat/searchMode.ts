/**
 * Sermon search vs Bible search. A chat's mode decides how every turn is
 * answered: Bible search sends `search_mode: "bible"`, which the /api/chat
 * proxy turns into the Bible FAQ mode for the first question and Bible
 * follow-ups after that. A Bible conversation is stored with
 * `conversations.source_faq_kind = 'bible'` (the same kind a follow-up on a
 * Bible FAQ page gets).
 *
 * Each account's default lives in auth user metadata (`search_mode`), set by
 * the question new sign-ups are asked and by the switch on /profile.
 */

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Which modes this reader has tried (drives the switch's nudge):
// searchModeTried.ts, client only.

export type SearchMode = "sermons" | "bible";

/** Accounts created before this never get the question; they default to sermons. */
const SEARCH_MODE_QUESTION_SINCE = "2026-11-01T00:00:00Z";

export function defaultSearchMode(user: User | null): SearchMode {
  return user?.user_metadata?.search_mode === "bible" ? "bible" : "sermons";
}

/** A new account that hasn't answered "Scripture or sermons?" yet. */
export function needsSearchModeChoice(user: User | null): boolean {
  if (!user) return false;
  const chosen = user.user_metadata?.search_mode;
  if (chosen === "bible" || chosen === "sermons") return false;
  return !!user.created_at && user.created_at >= SEARCH_MODE_QUESTION_SINCE;
}

export async function saveSearchMode(mode: SearchMode): Promise<void> {
  const { error } = await createClient().auth.updateUser({ data: { search_mode: mode } });
  if (error) throw error;
}
