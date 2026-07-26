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
// The RPC returns null when no row matches (share_hash is unique, so a
// match returns exactly one row or none, never more).
export async function fetchShareByHash(
  shareHash: string,
): Promise<ShareRow | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase.rpc("get_conversation_share", {
    p_share_hash: shareHash,
  });

  if (error) throw error;
  return data;
}

export async function fetchSharedMessages(
  conversationId: string,
  cutoffCreatedAt: string,
): Promise<SharedMessageRow[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .lte("created_at", cutoffCreatedAt)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
