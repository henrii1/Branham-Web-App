import { createClient } from "@/lib/supabase/client";

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string | null;
  conversation_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface RagRow {
  conversation_id: string;
  rag_context: string;
  retrieval_query: string;
  retrieval_metadata: unknown;
  updated_at: string;
}

const CONVERSATION_COLUMNS =
  "id, user_id, title, conversation_summary, created_at, updated_at" as const;
const MESSAGE_COLUMNS =
  "id, conversation_id, user_id, role, content, created_at" as const;
const RAG_COLUMNS =
  "conversation_id, rag_context, retrieval_query, retrieval_metadata, updated_at" as const;

export async function fetchConversations(
  userId: string,
): Promise<ConversationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchConversation(
  conversationId: string,
): Promise<ConversationRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchMessages(
  conversationId: string,
): Promise<MessageRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchLatestRag(
  conversationId: string,
): Promise<RagRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversation_rag")
    .select(RAG_COLUMNS)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createConversation(
  id: string,
  userId: string,
  title: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("conversations")
    .upsert(
      { id, user_id: userId, title },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) throw error;
}

export async function saveMessage(
  id: string,
  conversationId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_messages")
    .insert({
      id,
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
    });

  if (error) throw error;
}

export async function upsertRag(
  conversationId: string,
  ragContext: string,
  retrievalQuery: string,
  retrievalMetadata?: unknown,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("conversation_rag").upsert(
    {
      conversation_id: conversationId,
      rag_context: ragContext,
      retrieval_query: retrievalQuery,
      retrieval_metadata: retrievalMetadata ?? null,
    },
    { onConflict: "conversation_id" },
  );

  if (error) throw error;
}

export async function updateConversationAfterTurn(
  conversationId: string,
  summary: string | null,
): Promise<void> {
  const supabase = createClient();

  // Always trigger an UPDATE so the DB trigger auto-sets updated_at = now(),
  // moving this conversation to the top of the sidebar.
  const { error } = await supabase
    .from("conversations")
    .update(
      summary !== null
        ? { conversation_summary: summary }
        : { updated_at: new Date().toISOString() },
    )
    .eq("id", conversationId);

  if (error) throw error;
}
