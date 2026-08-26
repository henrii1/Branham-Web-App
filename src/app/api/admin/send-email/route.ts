import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/adminAllowlist";
import { resolveRecipients } from "@/lib/email/recipients";
import { applyGreeting, type EmailLanguage } from "@/lib/email/greeting";
import { sendBulkEmail } from "@/lib/email/sendEmail";

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

    const messages = recipients.map((recipient) => ({
      to: recipient.email,
      subject,
      bodyMarkdown: applyGreeting(bodyMarkdown, language, recipient.displayName),
    }));

    const result = await sendBulkEmail(messages);

    if (result.failed > 0) {
      console.error("Bulk email: some sends failed", result.failures);
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
