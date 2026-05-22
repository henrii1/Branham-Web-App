import { sendEmail } from "@/lib/email/sendEmail";
import { tryClaimAlert } from "./tryClaimAlert";

const ALERT_KEY = "model_call_failure";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ALERT_RECIPIENT = "emeraldhenry3@gmail.com";

export type ModelFailureKind = "upstream_eof_no_terminal" | "upstream_read_error";

interface MaybeSendModelFailureAlertInput {
  kind: ModelFailureKind;
  conversationId: string;
  query: string;
}

/**
 * Notify the operator (once per 7-day window) that the model service
 * failed mid-request. Safe to call from inside a streaming response —
 * the function returns a promise that the caller should pass to
 * `ctx.waitUntil(…)` so it can outlive the HTTP response.
 *
 * The 7-day rate-limit is enforced via an atomic Postgres UPDATE in
 * `tryClaimAlert`, so concurrent failures across Worker isolates don't
 * double-send.
 */
export async function maybeSendModelFailureAlert(
  input: MaybeSendModelFailureAlertInput,
): Promise<void> {
  const won = await tryClaimAlert(ALERT_KEY, WEEK_MS);
  if (!won) return;

  const reasonLabel =
    input.kind === "upstream_eof_no_terminal"
      ? "Upstream stream ended without a terminal SSE event (likely Cloud Run instance recycle / OOM / network drop)."
      : "The proxy's read from the upstream stream threw an error (connection interrupted).";

  const body = [
    "A model call failed.",
    "",
    `Detected at:    ${new Date().toISOString()} (UTC)`,
    `Failure kind:   ${input.kind}`,
    `Reason:         ${reasonLabel}`,
    `Conversation:   ${input.conversationId}`,
    `User query:     ${input.query.slice(0, 200)}${input.query.length > 200 ? "…" : ""}`,
    "",
    "This is a rate-limited alert. Subsequent failures within the next 7 days will be suppressed; you'll only hear about model failures once per week.",
  ].join("\n");

  const result = await sendEmail({
    to: ALERT_RECIPIENT,
    subject: "[Branham AI] Model call failure detected",
    bodyMarkdown: body,
  });

  if (!result.ok) {
    console.error("sendFailureAlert: Postmark send failed", result.error);
  }
}