/**
 * Sermon search vs Bible search. A chat's mode decides how every turn is
 * answered: Bible search sends `search_mode: "bible"`, which the /api/chat
 * proxy turns into the Bible FAQ mode for the first question and Bible
 * follow-ups after that. A Bible conversation is stored with
 * `conversations.source_faq_kind = 'bible'` (the same kind a follow-up on a
 * Bible FAQ page gets).
 *
 * Each account's default lives in auth user metadata (`search_mode`): the
 * mode of its last new chat (ChatShell updates it) or the switch on
 * /profile. Without one, new chats open in Bible search.
 */

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Which modes this reader has tried (drives the switch's nudge):
// searchModeTried.ts, client only.

export type SearchMode = "sermons" | "bible";

/** Accounts from before Bible search existed: they used the sermon search. */
const BIBLE_SEARCH_SINCE = "2026-11-01T00:00:00Z";

/**
 * The account's saved mode (its last-used one). Without one: sermon search
 * for accounts from before Bible search existed (what they always used),
 * Bible search for newer ones. Null for visitors who aren't signed in.
 */
export function accountSearchMode(user: User | null): SearchMode | null {
  if (!user) return null;
  const saved = user.user_metadata?.search_mode;
  if (saved === "bible" || saved === "sermons") return saved;
  return user.created_at && user.created_at < BIBLE_SEARCH_SINCE ? "sermons" : "bible";
}

export function defaultSearchMode(user: User | null): SearchMode {
  return accountSearchMode(user) ?? "bible";
}

export async function saveSearchMode(mode: SearchMode): Promise<void> {
  const { error } = await createClient().auth.updateUser({ data: { search_mode: mode } });
  if (error) throw error;
}
