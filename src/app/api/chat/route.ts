import { NextRequest } from "next/server";
import { checkFixedWindowRateLimit } from "@/lib/security/rateLimit";
import { INTERNAL_AUTH_HEADER } from "@/lib/security/requestHeaders";

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  conversation_id: string;
  query: string;
  user_language?: string;
  conversation_summary?: string;
  history_window?: ChatHistoryMessage[];
}

const MAX_CONVERSATION_ID_LENGTH = 128;
const MAX_QUERY_LENGTH = 4_000;
const MAX_LANGUAGE_LENGTH = 16;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_MESSAGE_LENGTH = 4_000;
const ANON_RATE_LIMIT = 10;
const ANON_RATE_LIMIT_WINDOW_MS = 60_000;

function jsonError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
) {
  return Response.json(
    { error: message, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

function getClientIp(request: NextRequest): string | null {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) return firstIp.trim();
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return null;
}

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }
  return normalized;
}

function parseHistoryWindow(
  value: unknown,
): ChatHistoryMessage[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES) {
    return null;
  }

  const history: ChatHistoryMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const role = "role" in item ? item.role : undefined;
    const content = "content" in item ? item.content : undefined;

    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string"
    ) {
      return null;
    }

    const normalizedContent = content.trim();
    if (
      !normalizedContent ||
      normalizedContent.length > MAX_HISTORY_MESSAGE_LENGTH
    ) {
      return null;
    }

    history.push({ role, content: normalizedContent });
  }

  return history;
}

function parseChatRequestBody(raw: unknown): ChatRequestBody | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const conversationId = normalizeString(
    "conversation_id" in raw ? raw.conversation_id : undefined,
    MAX_CONVERSATION_ID_LENGTH,
  );
  const query = normalizeString(
    "query" in raw ? raw.query : undefined,
    MAX_QUERY_LENGTH,
  );

  if (!conversationId || !query) {
    return null;
  }

  const languageValue = "user_language" in raw ? raw.user_language : undefined;
  const conversationSummaryValue =
    "conversation_summary" in raw ? raw.conversation_summary : undefined;
  const historyWindowValue =
    "history_window" in raw ? raw.history_window : undefined;

  const userLanguage =
    languageValue === undefined
      ? undefined
      : normalizeString(languageValue, MAX_LANGUAGE_LENGTH);
  const conversationSummary =
    conversationSummaryValue === undefined
      ? undefined
      : normalizeString(conversationSummaryValue, MAX_SUMMARY_LENGTH);
  const historyWindow = parseHistoryWindow(historyWindowValue);

  if (
    (languageValue !== undefined && !userLanguage) ||
    (conversationSummaryValue !== undefined && !conversationSummary) ||
    historyWindow === null
  ) {
    return null;
  }

  return {
    conversation_id: conversationId,
    query,
    user_language: userLanguage ?? undefined,
    conversation_summary: conversationSummary ?? undefined,
    history_window: historyWindow,
  };
}

export async function POST(request: NextRequest) {
  const apiBaseUrl = process.env.MODEL_API_BASE_URL;
  const bearerKey = process.env.CHAT_API_BEARER_KEY;

  if (!apiBaseUrl || !bearerKey) {
    return jsonError("Server configuration error", 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const body = parseChatRequestBody(rawBody);
  if (!body) {
    return jsonError("Invalid chat request payload", 400);
  }

  const isAuthenticated = request.headers.get(INTERNAL_AUTH_HEADER) === "1";

  if (!isAuthenticated) {
    const ipAddress = getClientIp(request);
    const fallbackFingerprint =
      request.headers.get("user-agent")?.slice(0, 120) ?? "unknown-client";
    const rateLimitKey = `anon:${ipAddress ?? fallbackFingerprint}`;
    const rateLimit = checkFixedWindowRateLimit(
      rateLimitKey,
      ANON_RATE_LIMIT,
      ANON_RATE_LIMIT_WINDOW_MS,
    );

    if (!rateLimit.allowed) {
      return jsonError(
        "Too many anonymous chat requests. Please wait a minute and try again.",
        429,
        {},
        {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1_000)),
        },
      );
    }
  }

  try {
    const upstream = await fetch(`${apiBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");
      return jsonError(
        `Upstream error (${upstream.status})`,
        upstream.status >= 500 ? 502 : upstream.status,
        errorText ? { details: errorText } : {},
      );
    }

    if (!upstream.body) {
      return jsonError("No response stream from upstream", 502);
    }

    // Explicit pull-based pipe to guarantee chunk-by-chunk streaming
    // (avoids potential buffering when passing upstream.body directly).
    //
    // Also synthesizes a terminal `error` + `done` SSE pair if the upstream
    // stream EOFs without sending one (Cloud Run OOM kill, instance recycle,
    // network drop, etc.). Without this, the FE state machine has no signal
    // that the request failed and gets stuck on "Finalizing response…".
    const upstreamReader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const TERMINAL_MARKERS = ["event: final", "event: error", "event: done"];

    const synthesizeTerminal = (message: string) =>
      encoder.encode(
        `event: error\ndata: ${JSON.stringify({ mode: "error", answer: message })}\n\n` +
          `event: done\ndata: ${JSON.stringify({ ok: false })}\n\n`,
      );

    let sawTerminal = false;
    let tail = "";

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await upstreamReader.read();
          if (done) {
            if (!sawTerminal) {
              try {
                controller.enqueue(
                  synthesizeTerminal(
                    "The service was momentarily unavailable. Please try again.",
                  ),
                );
              } catch {
                // Downstream already closed — nothing to do.
              }
            }
            controller.close();
            return;
          }

          if (!sawTerminal) {
            const combined = tail + decoder.decode(value, { stream: true });
            if (TERMINAL_MARKERS.some((m) => combined.includes(m))) {
              sawTerminal = true;
              tail = "";
            } else {
              // Keep enough tail bytes to catch markers split across chunks.
              tail = combined.slice(-32);
            }
          }

          controller.enqueue(value);
        } catch {
          if (!sawTerminal) {
            try {
              controller.enqueue(
                synthesizeTerminal(
                  "The connection to the model service was interrupted. Please try again.",
                ),
              );
            } catch {
              // Downstream already closed.
            }
          }
          try {
            controller.close();
          } catch {
            // Already closed/errored.
          }
        }
      },
      cancel() {
        upstreamReader.cancel();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return jsonError("Failed to reach upstream API", 502, {
      details: detail,
    });
  }
}
