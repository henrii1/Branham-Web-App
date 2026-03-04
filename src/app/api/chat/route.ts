import { NextRequest } from "next/server";

interface ChatRequestBody {
  conversation_id: string;
  query: string;
  user_language?: string;
  conversation_summary?: string;
  history_window?: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  const apiBaseUrl = process.env.MODEL_API_BASE_URL;
  const bearerKey = process.env.CHAT_API_BEARER_KEY;

  if (!apiBaseUrl || !bearerKey) {
    return Response.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.conversation_id || typeof body.conversation_id !== "string") {
    return Response.json(
      { error: "conversation_id is required" },
      { status: 400 },
    );
  }

  if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
    return Response.json(
      { error: "query is required and must be non-empty" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${apiBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");
      return Response.json(
        { error: `Upstream error (${upstream.status})`, details: errorText },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    if (!upstream.body) {
      return Response.json(
        { error: "No response stream from upstream" },
        { status: 502 },
      );
    }

    // Explicit pull-based pipe to guarantee chunk-by-chunk streaming
    // (avoids potential buffering when passing upstream.body directly)
    const upstreamReader = upstream.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel() {
        upstreamReader.cancel();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: "Failed to reach upstream API", details: detail },
      { status: 502 },
    );
  }
}
