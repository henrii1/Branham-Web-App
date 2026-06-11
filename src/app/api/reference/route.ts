import { NextRequest } from "next/server";
import { checkFixedWindowRateLimit } from "@/lib/security/rateLimit";
import { INTERNAL_AUTH_HEADER } from "@/lib/security/requestHeaders";

/**
 * Same-origin proxy for the sermon-reference tooltip lookup.
 *
 * Mirrors `src/app/api/chat/route.ts`: validates a small body, applies the same
 * per-IP anonymous rate-limit pattern, and injects the bearer key server-side
 * so it never reaches the client bundle. Unlike /api/chat this is plain JSON
 * (no SSE) — it's a fast read-only paragraph lookup, no LLM involved.
 *
 * Wire contract: `api_contract.md` → "POST /api/reference".
 */

interface ReferenceRange {
  paragraph_start: number;
  paragraph_end?: number;
}

interface ReferenceRequestBody {
  date_id: string;
  title?: string;
  ranges?: ReferenceRange[];
  paragraph_start?: number;
  paragraph_end?: number;
}

const MAX_DATE_ID_LENGTH = 32;
const MAX_TITLE_LENGTH = 200;
const MAX_RANGES = 20;
const MAX_PARAGRAPH_NO = 100_000;
// Clicks are cheap, so this is more generous than the chat proxy while keeping
// the same protective pattern against a runaway/abusive client.
const ANON_RATE_LIMIT = 60;
const ANON_RATE_LIMIT_WINDOW_MS = 60_000;

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
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

function parsePositiveInt(value: unknown): number | null {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (num < 1 || num > MAX_PARAGRAPH_NO) return null;
  return num;
}

function parseRange(value: unknown): ReferenceRange | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const start = parsePositiveInt(obj.paragraph_start);
  if (start === null) return null;

  const range: ReferenceRange = { paragraph_start: start };
  if (obj.paragraph_end !== undefined && obj.paragraph_end !== null) {
    const end = parsePositiveInt(obj.paragraph_end);
    if (end === null) return null;
    range.paragraph_end = end;
  }
  return range;
}

function parseReferenceBody(raw: unknown): ReferenceRequestBody | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const dateId =
    typeof obj.date_id === "string" ? obj.date_id.trim() : "";
  if (!dateId || dateId.length > MAX_DATE_ID_LENGTH) return null;

  const body: ReferenceRequestBody = { date_id: dateId };

  if (typeof obj.title === "string") {
    const title = obj.title.trim();
    if (title.length > MAX_TITLE_LENGTH) return null;
    if (title) body.title = title;
  }

  // Preferred multi-range form.
  if (obj.ranges !== undefined) {
    if (!Array.isArray(obj.ranges) || obj.ranges.length > MAX_RANGES) {
      return null;
    }
    const ranges: ReferenceRange[] = [];
    for (const item of obj.ranges) {
      const parsed = parseRange(item);
      if (!parsed) return null;
      ranges.push(parsed);
    }
    if (ranges.length === 0) return null;
    body.ranges = ranges;
    return body;
  }

  // Legacy single-range form.
  const start = parsePositiveInt(obj.paragraph_start);
  if (start === null) return null;
  body.paragraph_start = start;
  if (obj.paragraph_end !== undefined && obj.paragraph_end !== null) {
    const end = parsePositiveInt(obj.paragraph_end);
    if (end === null) return null;
    body.paragraph_end = end;
  }
  return body;
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

  const body = parseReferenceBody(rawBody);
  if (!body) {
    return jsonError("Invalid reference request payload", 400);
  }

  const isAuthenticated = request.headers.get(INTERNAL_AUTH_HEADER) === "1";

  if (!isAuthenticated) {
    const ipAddress = getClientIp(request);
    const fallbackFingerprint =
      request.headers.get("user-agent")?.slice(0, 120) ?? "unknown-client";
    const rateLimitKey = `anon-ref:${ipAddress ?? fallbackFingerprint}`;
    const rateLimit = checkFixedWindowRateLimit(
      rateLimitKey,
      ANON_RATE_LIMIT,
      ANON_RATE_LIMIT_WINDOW_MS,
    );

    if (!rateLimit.allowed) {
      return jsonError("Too many requests. Please wait a moment.", 429, {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      });
    }
  }

  try {
    const upstream = await fetch(`${apiBaseUrl}/api/reference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    const text = await upstream.text();

    // Pass the upstream JSON through unchanged (including 404 sermon_not_found
    // and 200-with-empty-group bodies — the client renders those states).
    return new Response(text, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return jsonError(`Failed to reach reference API: ${detail}`, 502);
  }
}
