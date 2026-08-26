import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { resolveRecipients } from "@/lib/email/recipients";
import { applyGreeting, type EmailLanguage } from "@/lib/email/greeting";
import { sendBulkEmail } from "@/lib/email/sendEmail";
import {
  hasRecentInFlightSend,
  startSend,
  completeSend,
  failSend,
  SendInFlightError,
} from "@/lib/email/sendHistory";

const SEND_IN_PROGRESS_MESSAGE =
  "A send from this account is already in progress — wait a moment and try again.";

const VALID_LANGUAGES: EmailLanguage[] = ["en", "es", "fr"];

interface RequestBody {
  language?: string;
  subject?: string;
  bodyMarkdown?: string;
  confirm?: boolean;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body || !VALID_LANGUAGES.includes(body.language as EmailLanguage)) {
    return Response.json({ ok: false, error: "invalid_language" }, { status: 400 });
  }
  const language = body.language as EmailLanguage;

  try {
    const admin = createAdminClient();
    const recipients = await resolveRecipients(admin, language);

    if (!body.confirm) {
      return Response.json({ ok: true, dryRun: true, recipientCount: recipients.length });
    }

    if (!body.subject?.trim() || !body.bodyMarkdown?.trim()) {
      return Response.json({ ok: false, error: "missing_content" }, { status: 400 });
    }
    const subject = body.subject.trim();
    const bodyMarkdown = body.bodyMarkdown;

    // Fast, non-authoritative pre-check: avoids attempting the insert (and
    // the Postmark work that would follow) in the common case. startSend's
    // unique-index guard below is the actual, race-proof enforcement.
    if (await hasRecentInFlightSend(admin, user.id)) {
      return Response.json({ ok: false, error: SEND_IN_PROGRESS_MESSAGE }, { status: 409 });
    }

    let sendId: string;
    try {
      sendId = await startSend(admin, {
        senderUserId: user.id,
        language,
        subject,
        bodyMarkdown,
        recipientCount: recipients.length,
      });
    } catch (err) {
      if (err instanceof SendInFlightError) {
        return Response.json({ ok: false, error: SEND_IN_PROGRESS_MESSAGE }, { status: 409 });
      }
      throw err;
    }

    let result;
    try {
      const messages = recipients.map((recipient) => ({
        to: recipient.email,
        subject,
        bodyMarkdown: applyGreeting(bodyMarkdown, language, recipient.displayName),
      }));
      result = await sendBulkEmail(messages);
    } catch (err) {
      await failSend(admin, sendId, err instanceof Error ? err.message : "Unknown error");
      throw err;
    }

    if (result.failed > 0) {
      console.error("Bulk email: some sends failed", result.failures);
    }

    // The send itself already happened by this point -- a failure to
    // record it must never turn into a false "the send failed" response
    // to the admin (which would invite a real duplicate send on retry).
    // Log and move on; the send-history row is left stuck at "sending"
    // until it self-heals via startSend's stale-row reclaim on the next
    // attempt, same bounded window as every other stuck-row case.
    try {
      await completeSend(admin, sendId, {
        sentCount: result.sent,
        failedCount: result.failed,
        failures: result.failures,
      });
    } catch (err) {
      console.error("Bulk email: send succeeded but failed to record completion", err);
    }

    return Response.json({
      ok: true,
      dryRun: false,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    console.error("Bulk email request failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
