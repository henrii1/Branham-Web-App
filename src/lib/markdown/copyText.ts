/**
 * Copying an answer: plain text for apps like WhatsApp, and HTML (headings,
 * bold, lists) for apps that paste formatting. Citations such as
 * [TITLE — 65-1128M: ¶12] stay as written in both, so the references travel
 * with the text. The HTML comes from our own renderMarkdown, without the
 * citation-pill markup.
 */

import { renderMarkdown } from "./render";

/** Markdown → readable plain text, citations kept in their brackets. */
export function markdownToCopyText(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/\\([*_`#[\]\\>-])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Put `markdown` on the clipboard as HTML + plain text, falling back to plain
 * text where the browser can't write HTML. Resolves false if the browser
 * refused.
 */
export async function copyMarkdown(markdown: string): Promise<boolean> {
  const text = markdownToCopyText(markdown);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const html = renderMarkdown(markdown);
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through to plain text */
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
