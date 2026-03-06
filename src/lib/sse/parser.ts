export interface SSEEvent {
  event: string;
  data: string;
}

export type ChatSSEEvent =
  | { type: "start"; conversationId: string }
  | {
      type: "rag";
      retrievalQuery: string;
      ragContext: string;
      retrieval: unknown;
    }
  | { type: "delta"; text: string }
  | {
      type: "final";
      mode: string;
      answer: string;
      externalInfo: unknown;
      conversationSummary: string | null;
      querySummary: string | null;
    }
  | { type: "done"; ok: boolean }
  | { type: "error"; mode: string; answer: string };

/**
 * Converts a raw SSE event into a typed ChatSSEEvent.
 * Returns null for unknown event types or malformed data.
 */
function parseChatEvent(raw: SSEEvent): ChatSSEEvent | null {
  try {
    const data = JSON.parse(raw.data);
    switch (raw.event) {
      case "start":
        return { type: "start", conversationId: data.conversation_id };
      case "rag":
        return {
          type: "rag",
          retrievalQuery: data.retrieval_query,
          ragContext: data.rag_context,
          retrieval: data.retrieval,
        };
      case "delta":
        return { type: "delta", text: data.text };
      case "final":
        return {
          type: "final",
          mode: data.mode,
          answer: data.answer,
          externalInfo: data.external_info ?? null,
          conversationSummary: data.conversation_summary ?? null,
          querySummary: data.query_summary ?? null,
        };
      case "done":
        return { type: "done", ok: data.ok };
      case "error":
        return {
          type: "error",
          mode: data.mode ?? "error",
          answer: data.answer ?? "An unexpected error occurred.",
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Reads an SSE stream and calls onEvent for each parsed event.
 * Uses a simple while-loop (no async generators) for maximum
 * bundler compatibility and immediate callback dispatch.
 */
export async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: ChatSSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];

  function flush() {
    if (eventType && dataLines.length > 0) {
      const raw: SSEEvent = { event: eventType, data: dataLines.join("\n") };
      const parsed = parseChatEvent(raw);
      if (parsed) onEvent(parsed);
    }
    eventType = "";
    dataLines = [];
  }

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Normalize \r\n and stray \r to \n for cross-platform safety
      buffer = buffer.replace(/\r\n?/g, "\n");

      const lines = buffer.split("\n");
      // Last element is incomplete — keep in buffer for next chunk
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (signal?.aborted) return;

        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        } else if (line === "") {
          flush();
        }
        // SSE comment lines (starting with ':') are silently ignored
      }
    }

    // Stream ended — flush any remaining partial event
    if (!signal?.aborted) flush();
  } finally {
    reader.releaseLock();
  }
}
