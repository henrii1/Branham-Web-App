export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  language?: string;
}

export interface RagData {
  retrievalQuery: string;
  ragContext: string;
  retrieval: unknown[];
}

export type StreamingStatus =
  | "idle"
  | "connecting"
  | "rag_received"
  | "streaming"
  | "complete"
  | "error";

export type AnswerViewMode = "full" | "quotes";

export interface Conversation {
  id: string;
  title: string | null;
  conversationSummary: string | null;
  updatedAt: string;
}
