/**
 * Client-side helpers for the sermon-reference tooltip.
 *
 * When a user clicks a citation pill, the FE parses the pill's data-* attributes
 * into a request and POSTs it to the same-origin proxy `/api/reference` (which
 * injects the bearer key server-side). The endpoint returns the cited sermon
 * paragraphs plus ±1 context per range. Responses are memoized for the session
 * so re-opening the same pill is instant.
 *
 * Wire contract: see `api_contract.md` → "POST /api/reference".
 */

export interface ReferenceRange {
  paragraph_start: number;
  paragraph_end?: number;
}

export interface ReferenceRequest {
  date_id: string;
  title?: string;
  ranges: ReferenceRange[];
}

/** One sermon cited by a pill. A single pill may cite several of these. */
export type SermonReference = ReferenceRequest;

export interface ReferenceParagraph {
  paragraph_no: number;
  sub_id: string;
  text: string;
  is_context: boolean;
}

export interface ReferenceGroup {
  requested: ReferenceRange;
  returned: { paragraph_start: number; paragraph_end: number };
  paragraphs: ReferenceParagraph[];
}

export interface ReferenceResponse {
  ok: boolean;
  date_id: string;
  title: string;
  groups: ReferenceGroup[];
}

/**
 * Reads the cited sermons out of a clickable pill element's `data-references`
 * attribute (written by `makePill` in `lib/markdown/citations.ts`). A pill may
 * bundle several sermons, so this returns an array. Returns null when the
 * element isn't a resolvable sermon pill.
 */
export function parsePillElement(el: HTMLElement): SermonReference[] | null {
  const raw = el.getAttribute("data-references");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SermonReference[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    return null;
  }
  return null;
}

function cacheKey(req: ReferenceRequest): string {
  return `${req.date_id}|${JSON.stringify(req.ranges)}`;
}

// Per-session cache (cleared on full reload). Clicks are cheap but identical
// re-clicks shouldn't hit the network again.
const responseCache = new Map<string, ReferenceResponse>();

export async function fetchReference(
  req: ReferenceRequest,
  signal?: AbortSignal,
): Promise<ReferenceResponse> {
  const key = cacheKey(req);
  const cached = responseCache.get(key);
  if (cached) return cached;

  const res = await fetch("/api/reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Reference request failed (${res.status})`);
  }

  const data = (await res.json()) as ReferenceResponse;
  responseCache.set(key, data);
  return data;
}
