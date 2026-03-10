import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";
import {
  FALLBACK_WELCOME_EMAIL_TEMPLATE,
  type WelcomeEmailTemplate,
} from "@/lib/email/welcomeTemplate";

interface IntroMessageRow {
  language: string;
  subject: string;
  body_markdown: string;
}

function normalizeTemplate(
  row: IntroMessageRow | null,
): WelcomeEmailTemplate | null {
  if (!row?.subject || !row.body_markdown) {
    return null;
  }

  return {
    language: row.language,
    subject: row.subject,
    bodyMarkdown: row.body_markdown,
  };
}

async function getWelcomeTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  preferredLanguage: string,
): Promise<WelcomeEmailTemplate> {
  const { data, error } = await supabase
    .from("intro_messages")
    .select("language, subject, body_markdown")
    .in("language", Array.from(new Set([preferredLanguage, "en"])))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load intro message template:", error);
    return FALLBACK_WELCOME_EMAIL_TEMPLATE;
  }

  const exactMatch =
    data?.find((row) => row.language === preferredLanguage) ?? null;
  const englishFallback = data?.find((row) => row.language === "en") ?? null;

  return (
    normalizeTemplate(exactMatch) ??
    normalizeTemplate(englishFallback) ??
    FALLBACK_WELCOME_EMAIL_TEMPLATE
  );
}

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      { ok: false, sent: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  if (!user.email) {
    return Response.json({ ok: true, sent: false, reason: "missing_email" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("language, welcome_email_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile for welcome email:", profileError);
    return Response.json(
      { ok: false, sent: false, reason: "profile_lookup_failed" },
      { status: 500 },
    );
  }

  if (profile?.welcome_email_sent_at) {
    return Response.json({
      ok: true,
      sent: false,
      reason: "already_sent",
    });
  }

  const template = await getWelcomeTemplate(supabase, profile?.language ?? "en");
  const sendResult = await sendWelcomeEmail({
    to: user.email,
    subject: template.subject,
    bodyMarkdown: template.bodyMarkdown,
  });

  if (!sendResult.ok) {
    console.error("Welcome email send failed:", sendResult.error);
    return Response.json({
      ok: true,
      sent: false,
      reason: "provider_failed",
      error: sendResult.error,
    });
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: sentAt })
    .eq("user_id", user.id)
    .is("welcome_email_sent_at", null);

  if (updateError) {
    console.error("Failed to store welcome_email_sent_at:", updateError);
    return Response.json({
      ok: true,
      sent: true,
      reason: "sent_but_not_marked",
      messageId: sendResult.messageId,
    });
  }

  return Response.json({
    ok: true,
    sent: true,
    messageId: sendResult.messageId,
  });
}
