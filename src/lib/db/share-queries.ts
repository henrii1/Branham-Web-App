import { createClient } from "@supabase/supabase-js";

export interface ShareRow {
  id: string;
  share_hash: string;
  conversation_id: string;
  owner_id: string;
  language: string;
  cutoff_created_at: string;
  title_snapshot: string | null;
  rag_context_snapshot: string | null;
  retrieval_query_snapshot: string | null;
  retrieval_metadata_snapshot: unknown;
  conversation_summary_snapshot: string | null;
  created_at: string;
}

export interface SharedMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

// Goes through the get_conversation_share() RPC (Task 1), not a direct
// `.from("conversation_shares").select()` — direct table select is
// revoked for anon/authenticated, so this is the only valid read path.
// The underlying SQL function is declared `returns public.conversation_shares`
// (a scalar composite, not `setof`) — when zero rows match, Postgres
// returns a single row with every field NULL rather than a true SQL NULL,
// so PostgREST serializes a *truthy* object with every property null
// instead of `null`. Normalize that here so callers can rely on
// `ShareRow | null` meaning "found" vs "not found".
export async function fetchShareByHash(
  shareHash: string,
): Promise<ShareRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase.rpc("get_conversation_share", {
    p_share_hash: shareHash,
  });

  if (error) throw error;
  if (!data || data.id === null) return null;
  return data;
}

// Goes through the get_shared_messages() RPC, not a direct
// `.from("chat_messages").select()` — a plain table-level policy
// would grant access to every message of any shared conversation to
// anyone holding the public anon key, since anon/authenticated retain
// the default SELECT grant on chat_messages; it can't be scoped to
// "the caller possesses this specific hash" without going through a
// function that takes the hash as an argument. This RPC does the
// share_hash -> conversation_id -> cutoff join internally.
export async function fetchSharedMessages(
  shareHash: string,
): Promise<SharedMessageRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .rpc("get_shared_messages", { p_share_hash: shareHash })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
