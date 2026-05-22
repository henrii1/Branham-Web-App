import { createClient } from "@supabase/supabase-js";

/**
 * Atomically claim the right to send an alert, bounded by an interval.
 *
 * Implementation: one row per `key` in `public.alert_state` with a
 * `last_sent_at` timestamp. We issue an UPDATE…WHERE…RETURNING that
 * only succeeds when the row's previous `last_sent_at` is older than
 * `intervalMs`. Postgres serialises concurrent UPDATEs, so at most one
 * concurrent failing request "wins" the claim — the rest see no row
 * returned and skip.
 *
 * Returns `true` if this caller won the claim and should send the
 * alert; `false` otherwise (including any error path — we'd rather
 * silently skip an alert than crash the request).
 */
export async function tryClaimAlert(
  key: string,
  intervalMs: number,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("tryClaimAlert: Supabase env vars are not configured");
    return false;
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const threshold = new Date(Date.now() - intervalMs).toISOString();
  const now = new Date().toISOString();

  // UPDATE…WHERE last_sent_at < threshold RETURNING key. The first
  // concurrent caller flips last_sent_at to `now`; subsequent callers
  // see the new (recent) timestamp and the WHERE clause excludes them.
  const { data, error } = await supabase
    .from("alert_state")
    .update({ last_sent_at: now, updated_at: now })
    .eq("key", key)
    .lt("last_sent_at", threshold)
    .select("key");

  if (error) {
    console.error("tryClaimAlert: update failed", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}