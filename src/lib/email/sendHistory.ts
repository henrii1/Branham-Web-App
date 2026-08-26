import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailLanguage } from "./greeting";

const IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

export interface SendFailure {
  email: string;
  error: string;
}

export interface StartSendInput {
  senderUserId: string;
  language: EmailLanguage;
  subject: string;
  bodyMarkdown: string;
  recipientCount: number;
}

/**
 * True if this sender already has a send recorded as "sending" within the
 * last IN_FLIGHT_WINDOW_MS -- used to reject a second confirmed send while
 * one may still be in flight (a reload, a second tab, or a retried request
 * could otherwise trigger a real double-send with no client-side signal).
 * A "sending" row older than the window is treated as stale (e.g. from a
 * crashed request) and does not block a new send.
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

/** Inserts a "sending" row before the Postmark batch call starts. Returns the new row's id. */
export async function startSend(admin: SupabaseClient, input: StartSendInput): Promise<string> {
  const { data, error } = await admin
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
