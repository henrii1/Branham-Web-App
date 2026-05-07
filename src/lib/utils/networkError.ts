/**
 * Detect whether an error from `fetch` (or a Supabase call that uses fetch
 * under the hood) is the result of the user being offline, as opposed to
 * an HTTP error, an upstream 5xx, etc.
 *
 * Browsers throw a `TypeError` (typically with a message containing "fetch")
 * when the network is unreachable. `navigator.onLine === false` is a softer
 * signal — it can lie (always false on some VPNs, true on captive portals),
 * but when it IS false we can be confident. Use both: if either fires, treat
 * it as offline.
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  // Plain TypeError from a direct fetch() call.
  if (err instanceof TypeError && matchesOfflineMessage(err.message)) {
    return true;
  }
  // Supabase wraps the underlying fetch failure in its own error object
  // (`{ message, details, hint, code }`), so `instanceof TypeError` is false.
  // Inspect `.message` (and `.details`) directly instead.
  if (err && typeof err === "object") {
    const candidate = err as { message?: unknown; details?: unknown };
    if (typeof candidate.message === "string" && matchesOfflineMessage(candidate.message)) {
      return true;
    }
    if (typeof candidate.details === "string" && matchesOfflineMessage(candidate.details)) {
      return true;
    }
  }
  return false;
}

function matchesOfflineMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  );
}
