const POSTMARK_EMAIL_ENDPOINT = "https://api.postmarkapp.com/email";
const DEFAULT_FROM_EMAIL = "info@branhamsermons.ai";
// Bulk/announcement mail goes out on its own Postmark stream, separate from
// the "outbound" transactional stream the welcome email uses below -- so a
// bulk send being flagged or throttled by Postmark can never take down
// transactional mail, and vice versa.
const BULK_MESSAGE_STREAM = "send-bulk-email";

interface SendEmailInput {
  to: string;
  subject: string;
  bodyMarkdown: string;
  from?: string;
}

export interface SendEmailResult {
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

// Black text on white, set inline on every element: mail clients strip
// <style> blocks, and without an explicit color some apps (dark-mode Gmail,
// Apple Mail, Outlook) substitute their own text color. The color-scheme
// metas ask clients that honor them not to recolor the message.
const EMAIL_TEXT_COLOR = "#000000";
const EMAIL_BACKGROUND = "#ffffff";

const EMAIL_LINK_COLOR = "#1d4ed8";
const BULLET_RE = /^\s*(?:•|-)\s+/;

/**
 * Inline formatting on already-escaped text: **bold**, [label](https://url),
 * and bare https:// URLs. Only http(s) links are produced.
 */
function formatInline(escaped: string): string {
  const link = (href: string, label: string) =>
    `<a href="${href}" style="color:${EMAIL_LINK_COLOR};text-decoration:underline;">${label}</a>`;
  return escaped
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${EMAIL_TEXT_COLOR};">$1</strong>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, href: string) => link(href, label))
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (_m, pre: string, href: string) => `${pre}${link(href, href)}`);
}

/**
 * A small, safe markdown subset for email bodies: blank-line paragraphs,
 * kept line breaks, `# ` / `## ` headings, `•` or `-` bullet lists, bold
 * and http(s) links. Everything is HTML-escaped before formatting.
 */
export function markdownToEmailHtml(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    const h = /^(#{1,2})\s+(.+)$/.exec(trimmed);
    if (h && !trimmed.includes("\n")) {
      const size = h[1].length === 1 ? "24px" : "19px";
      const tag = h[1].length === 1 ? "h1" : "h2";
      return `<${tag} style="margin:8px 0 14px 0;font-size:${size};line-height:1.3;font-weight:700;color:${EMAIL_TEXT_COLOR};">${formatInline(escapeHtml(h[2]))}</${tag}>`;
    }

    // Group consecutive bullet lines into a list; other lines stay a paragraph.
    const parts: string[] = [];
    let text: string[] = [];
    let items: string[] = [];
    const flushText = () => {
      if (text.length) parts.push(`<p style="margin:0 0 16px 0;color:${EMAIL_TEXT_COLOR};">${text.join("<br />")}</p>`);
      text = [];
    };
    const flushItems = () => {
      if (items.length) {
        parts.push(
          `<ul style="margin:0 0 16px 0;padding-left:22px;color:${EMAIL_TEXT_COLOR};">${items
            .map((i) => `<li style="margin:0 0 6px 0;color:${EMAIL_TEXT_COLOR};">${i}</li>`)
            .join("")}</ul>`,
        );
      }
      items = [];
    };
    for (const line of block.split("\n")) {
      if (BULLET_RE.test(line)) {
        flushText();
        items.push(formatInline(escapeHtml(line.replace(BULLET_RE, ""))));
      } else {
        flushItems();
        text.push(formatInline(escapeHtml(line)));
      }
    }
    flushText();
    flushItems();
    return parts.join("");
  });
  const paragraphs = blocks.join("");

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="color-scheme" content="light only">` +
    `<meta name="supported-color-schemes" content="light">` +
    `</head><body style="margin:0;padding:0;background-color:${EMAIL_BACKGROUND};color:${EMAIL_TEXT_COLOR};">` +
    `<div style="background-color:${EMAIL_BACKGROUND};color:${EMAIL_TEXT_COLOR};padding:16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">` +
    paragraphs +
    `</div></body></html>`
  );
}

/** Plain-text part: the same body with the formatting marks removed. */
export function markdownToEmailText(markdown: string): string {
  return markdown
    .replace(/^#{1,2}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, href: string) =>
      label === href ? href : `${label} (${href})`,
    );
}

/**
 * Send a transactional email via Postmark. The body is treated as light
 * markdown (paragraphs split on blank lines, line breaks preserved) and
 * an escaped HTML body is generated alongside the plain-text version.
 */
export async function sendEmail({
  to,
  subject,
  bodyMarkdown,
  from = process.env.POSTMARK_FROM_EMAIL || DEFAULT_FROM_EMAIL,
}: SendEmailInput): Promise<SendEmailResult> {
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
      TextBody: markdownToEmailText(bodyMarkdown),
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

// Back-compat alias for callers that imported the old welcome-email helper.
export const sendWelcomeEmail = sendEmail;
export type SendWelcomeEmailResult = SendEmailResult;

const POSTMARK_BATCH_ENDPOINT = "https://api.postmarkapp.com/email/batch";
const BULK_BATCH_SIZE = 500;

export interface BulkEmailMessage {
  to: string;
  subject: string;
  bodyMarkdown: string;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  failures: Array<{ to: string; error: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sends a personalized message to each recipient individually via
 * Postmark's batch endpoint (never a shared To list), chunked to its
 * 500-message-per-call limit. Batches run SEQUENTIALLY -- not Promise.all --
 * since Cloudflare Workers caps simultaneous in-flight connections waiting
 * on response headers at 6 per invocation, and this isn't latency-sensitive
 * (no user is waiting on a streamed response, unlike chat).
 */
export async function sendBulkEmail(
  messages: BulkEmailMessage[],
  from: string = process.env.POSTMARK_FROM_EMAIL || DEFAULT_FROM_EMAIL,
): Promise<BulkSendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const result: BulkSendResult = {
    total: messages.length,
    sent: 0,
    failed: 0,
    failures: [],
  };

  if (!token) {
    result.failed = messages.length;
    result.failures = messages.map((m) => ({
      to: m.to,
      error: "POSTMARK_SERVER_TOKEN is not configured.",
    }));
    return result;
  }

  for (const batch of chunk(messages, BULK_BATCH_SIZE)) {
    // fetch() itself can throw (network blip, DNS failure) -- caught here,
    // not left to propagate, so a mid-run exception never loses the
    // sent/failed counts already accumulated from earlier batches. This
    // batch is simply recorded as failed and the loop continues, the same
    // way an HTTP-level failure below is handled.
    let response: Response;
    try {
      response = await fetch(POSTMARK_BATCH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify(
          batch.map((m) => ({
            From: from,
            To: m.to,
            Subject: m.subject,
            TextBody: markdownToEmailText(m.bodyMarkdown),
            HtmlBody: markdownToEmailHtml(m.bodyMarkdown),
            MessageStream: BULK_MESSAGE_STREAM,
          })),
        ),
      });
    } catch (err) {
      for (const m of batch) {
        result.failed += 1;
        result.failures.push({
          to: m.to,
          error: `Postmark batch request threw: ${err instanceof Error ? err.message : "unknown network error"}.`,
        });
      }
      continue;
    }

    const payload = (await response.json().catch(() => null)) as PostmarkResponse[] | null;

    if (!response.ok || !payload) {
      for (const m of batch) {
        result.failed += 1;
        result.failures.push({
          to: m.to,
          error: `Postmark batch request failed with ${response.status}.`,
        });
      }
      continue;
    }

    payload.forEach((item, index) => {
      const recipient = batch[index];
      if (item.ErrorCode === 0) {
        result.sent += 1;
      } else {
        result.failed += 1;
        result.failures.push({ to: recipient?.to ?? "unknown", error: item.Message });
      }
    });

    if (payload.length < batch.length) {
      for (let i = payload.length; i < batch.length; i++) {
        result.failed += 1;
        result.failures.push({
          to: batch[i].to,
          error: "No response received from Postmark for this recipient.",
        });
      }
    }
  }

  return result;
}