const POSTMARK_EMAIL_ENDPOINT = "https://api.postmarkapp.com/email";
const DEFAULT_FROM_EMAIL = "info@branhamsermons.ai";

interface SendWelcomeEmailInput {
  to: string;
  subject: string;
  bodyMarkdown: string;
  from?: string;
}

export interface SendWelcomeEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  status?: number;
}

interface PostmarkResponse {
  ErrorCode: number;
  Message: string;
  MessageID?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownToEmailHtml(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export async function sendWelcomeEmail({
  to,
  subject,
  bodyMarkdown,
  from = process.env.POSTMARK_FROM_EMAIL || DEFAULT_FROM_EMAIL,
}: SendWelcomeEmailInput): Promise<SendWelcomeEmailResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;

  if (!token) {
    return {
      ok: false,
      error: "POSTMARK_SERVER_TOKEN is not configured.",
      status: 500,
    };
  }

  const response = await fetch(POSTMARK_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      TextBody: bodyMarkdown,
      HtmlBody: markdownToEmailHtml(bodyMarkdown),
      MessageStream: "outbound",
    }),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as PostmarkResponse | null;

  if (!response.ok || !payload || payload.ErrorCode !== 0) {
    return {
      ok: false,
      status: response.status,
      error: payload?.Message || `Postmark request failed with ${response.status}.`,
    };
  }

  return {
    ok: true,
    status: response.status,
    messageId: payload.MessageID,
  };
}
