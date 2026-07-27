import { generateId } from "@/lib/utils/ids";
import {
  createConversation,
  saveMessage,
  upsertRag,
  updateConversationAfterTurn,
} from "@/lib/db/queries";
import { fetchShareByHash, fetchSharedMessages } from "@/lib/db/share-queries";

/**
 * Forks a shared conversation into a brand-new conversation owned by
 * `newOwnerId`. Messages are copied in original order with sequential
 * awaits (not Promise.all) so each row's created_at stays monotonic —
 * chat_messages is always read back ordered by created_at ascending.
 * The new conversation's title comes from share.title_snapshot, not a
 * live read of the original `conversations` row — Task 1's RLS design
 * means there is no public select policy to read that row live at all.
 */
export async function forkConversationFromShare(
  shareHash: string,
  newOwnerId: string,
): Promise<string | null> {
  const share = await fetchShareByHash(shareHash);
  if (!share) return null;

  const messages = await fetchSharedMessages(shareHash);
  if (messages.length === 0) return null;

  const newConversationId = generateId();
  await createConversation(newConversationId, newOwnerId, share.title_snapshot);

  for (const message of messages) {
    await saveMessage(generateId(), newConversationId, newOwnerId, message.role, message.content);
  }

  await Promise.all([
    share.rag_context_snapshot
      ? upsertRag(
          newConversationId,
          share.rag_context_snapshot,
          share.retrieval_query_snapshot ?? "",
          share.retrieval_metadata_snapshot,
        )
      : Promise.resolve(),
    updateConversationAfterTurn(newConversationId, share.conversation_summary_snapshot),
  ]);

  return newConversationId;
}
