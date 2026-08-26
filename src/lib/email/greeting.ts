export type EmailLanguage = "en" | "es" | "fr";

// Matches a hand-typed leading salutation line in the target send language,
// so it can be stripped before the code-generated greeting is prepended
// (never duplicated). Only the first non-blank line of the body is ever
// checked against this.
const GREETING_STRIP_PATTERNS: Record<EmailLanguage, RegExp> = {
  en: /^(dear|hi|hello|hey)\b.*,\s*$/i,
  es: /^(hola|estimado|estimada|querido|querida)\b.*,\s*$/i,
  fr: /^(bonjour|cher|ch[eè]re|salut)\b.*,\s*$/i,
};

const NAMED_GREETING: Record<EmailLanguage, (name: string) => string> = {
  en: (name) => `Dear ${name},`,
  es: (name) => `Hola ${name},`,
  fr: (name) => `Bonjour ${name},`,
};

const GENERIC_GREETING: Record<EmailLanguage, string> = {
  en: "Hello,",
  es: "Hola,",
  fr: "Bonjour,",
};

/**
 * The greeting line for one recipient: named if `displayName` is present
 * and non-blank, a plain nameless greeting otherwise (every Email-OTP
 * signup has a null display_name — only Google OAuth populates it).
 */
export function buildGreeting(language: EmailLanguage, displayName: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? NAMED_GREETING[language](trimmed) : GENERIC_GREETING[language];
}

/**
 * Strips a hand-typed leading salutation line in `language` (if present)
 * and prepends the code-generated greeting for this recipient. Only the
 * first non-blank line is ever inspected.
 */
export function applyGreeting(
  bodyMarkdown: string,
  language: EmailLanguage,
  displayName: string | null,
): string {
  const lines = bodyMarkdown.split("\n");
  let firstContentIdx = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIdx === -1) firstContentIdx = 0;

  const isHandTypedGreeting = GREETING_STRIP_PATTERNS[language].test(
    lines[firstContentIdx]?.trim() ?? "",
  );
  const remainingLines = isHandTypedGreeting ? lines.slice(firstContentIdx + 1) : lines;

  const rest = remainingLines.join("\n").replace(/^\n+/, "");
  const greeting = buildGreeting(language, displayName);
  return rest ? `${greeting}\n\n${rest}` : greeting;
}
