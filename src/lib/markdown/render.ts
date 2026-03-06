/**
 * Markdown → safe HTML renderer (§7 of design spec).
 *
 * Uses `marked` configured for security:
 *  - Allows: paragraphs, emphasis, strong, lists, blockquotes,
 *    links (http/https only), headings, code blocks, hr.
 *  - Disallows all raw HTML passthrough.
 *  - Links: only http:// and https:// schemes,
 *    adds rel="noopener noreferrer" + target="_blank".
 */
import { Marked } from "marked";

// ── HTML entity escaping for attribute safety ────────────────────────
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Shared Marked instance (avoids re-creation on every call) ────────
const md = new Marked();

md.use({
  gfm: true,
  breaks: false,
  renderer: {
    // Enforce link safety: only http/https, add security attributes
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (
        !href ||
        (!href.startsWith("http://") && !href.startsWith("https://"))
      ) {
        // Unsafe scheme — render as plain text, strip the link
        return text;
      }
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    },

    // Strip all raw HTML passthrough (§7: disallow all raw HTML)
    html() {
      return "";
    },
  },
});

/**
 * Renders markdown string to sanitized HTML.
 * Synchronous — safe for use in render paths and streaming hot loops.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  return md.parse(text) as string;
}
