import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLanguage } from "./greeting";
import type { BulkSendResult } from "./sendEmail";

// A send genuinely running longer than this (very large recipient list)
// stops being protected against a concurrent second send once the window
// elapses -- accepted trade-off, not expected at this tool's realistic
// scale (a few hundred recipients easily completes in well under a
// minute; see sendBulkEmail's own sequential-batch comment).
const IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

const UNIQUE_VIOLATION = "23505";

export type SendFailure = BulkSendResult["failures"][number];

export interface StartSendInput {
  senderUserId: string;
  language: EmailLanguage;
  subject: string;
  bodyMarkdown: string;
  recipientCount: number;
}

/** Thrown by startSend when another send is genuinely still in flight for this sender. */
export class SendInFlightError extends Error {
  constructor() {
    super("A send from this account is already in progress.");
    this.name = "SendInFlightError";
  }
}

/**
 * Fast, non-authoritative pre-check: true if this sender has a "sending"
 * row from within the last IN_FLIGHT_WINDOW_MS. Cheap way to reject an
 * obviously-duplicate request before doing any real work (resolving
 * recipients, etc). startSend's unique-index guard is the actual
 * enforcement -- this just avoids hitting it in the common case.
 */
export async function hasRecentInFlightSend(
  admin: SupabaseClient,
  senderUserId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - IN_FLIGHT_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("admin_email_sends")
    .select("id")
    .eq("sender_user_id", senderUserId)
    .eq("status", "sending")
    .gt("created_at", cutoff)
    .limit(1);

  if (error) throw new Error(`Failed to check in-flight sends: ${error.message}`);
  return (data ?? []).length > 0;
}

async function insertSendRow(admin: SupabaseClient, input: StartSendInput) {
  return admin
    .from("admin_email_sends")
    .insert({
      sender_user_id: input.senderUserId,
      language: input.language,
      subject: input.subject,
      body_markdown: input.bodyMarkdown,
      recipient_count: input.recipientCount,
      status: "sending",
    })
    .select("id")
    .single();
}

/**
 * Marks any "sending" row for this sender older than the in-flight window
 * as failed (a crashed/abandoned request, not a real concurrent send).
 * Returns true if a row was reclaimed, so the caller knows a retry is
 * worth attempting.
 */
async function reclaimStaleSend(admin: SupabaseClient, senderUserId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - IN_FLIGHT_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("admin_email_sends")
    .update({
      status: "failed",
      error: "Send timed out or crashed without completing.",
      completed_at: new Date().toISOString(),
    })
    .eq("sender_user_id", senderUserId)
    .eq("status", "sending")
    .lt("created_at", cutoff)
    .select("id");

  if (error) throw new Error(`Failed to reclaim stale send: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Inserts a "sending" row before the Postmark batch call starts. Returns
 * the new row's id.
 *
 * Atomic against concurrent sends via a partial unique index on
 * (sender_user_id) WHERE status = 'sending' (see the migration) -- at
 * most one in-flight row per sender can ever exist at the database level,
 * closing the race a plain check-then-insert would leave open. If the
 * insert collides with an existing row that's past the in-flight window
 * (a crashed/abandoned request, not a real concurrent send), that row is
 * reclaimed (marked failed) and the insert is retried once, so a stuck
 * row can never permanently lock a sender out -- only for up to
 * IN_FLIGHT_WINDOW_MS, same bound hasRecentInFlightSend already promises.
 */
export async function startSend(admin: SupabaseClient, input: StartSendInput): Promise<string> {
  let { data, error } = await insertSendRow(admin, input);

  if (error?.code === UNIQUE_VIOLATION) {
    const reclaimed = await reclaimStaleSend(admin, input.senderUserId);
    if (reclaimed) {
      ({ data, error } = await insertSendRow(admin, input));
    }
  }

  if (error?.code === UNIQUE_VIOLATION) {
    throw new SendInFlightError();
  }
  if (error || !data) {
    throw new Error(`Failed to record send start: ${error?.message ?? "no row returned"}`);
  }
  return (data as { id: string }).id;
}

/** Marks a send row complete with its final counts. */
export async function completeSend(
  admin: SupabaseClient,
  sendId: string,
  result: { sentCount: number; failedCount: number; failures: SendFailure[] },
): Promise<void> {
  const { error } = await admin
    .from("admin_email_sends")
    .update({
      status: "complete",
      sent_count: result.sentCount,
      failed_count: result.failedCount,
      failures: result.failures,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sendId);

  if (error) throw new Error(`Failed to record send completion: ${error.message}`);
}

/** Marks a send row failed (the request threw before or while sending). */
export async function failSend(
  admin: SupabaseClient,
  sendId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await admin
    .from("admin_email_sends")
    .update({
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sendId);

  if (error) throw new Error(`Failed to record send failure: ${error.message}`);
}
