"use client";

import { useState } from "react";
import { getChatStrings } from "@/lib/i18n/chatStrings";

const ANON_ACK_KEY = "branham_sensitive_disclaimer_ack_v1";

// Logged-in users: once ever per account on this browser, stored in
// localStorage keyed by user id — survives new tabs/sessions and even a
// later logout/login, so it only interrupts once. Anonymous users have no
// stable identity, so they get the weaker "once per browser session"
// behavior via sessionStorage instead (once each time they open the app).
function getAckStorage(userId: string | null): Storage {
  return userId ? localStorage : sessionStorage;
}
function getAckKey(userId: string | null): string {
  return userId ? `branham_sensitive_disclaimer_ack_user_${userId}` : ANON_ACK_KEY;
}

export function SensitiveUseModal({
  language = "en",
  userId = null,
}: {
  language?: string;
  userId?: string | null;
}) {
  const [visible, setVisible] = useState(
    () => !getAckStorage(userId).getItem(getAckKey(userId)),
  );

  const s = getChatStrings(language);

  function acknowledge() {
    getAckStorage(userId).setItem(getAckKey(userId), "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop — deliberately no onClick here. This warning must be
          actively acknowledged, not dismissed by an accidental outside
          click. */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Sheet on mobile (slides up from bottom), centered card on sm+.
          No close (X) button — "I understand" is the only way out. */}
      <div className="relative w-full rounded-t-2xl bg-[var(--surface-base)] p-6 shadow-xl sm:max-w-sm sm:rounded-2xl dark:border dark:border-zinc-700">
        <div className="mb-4 flex items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <h2 className="text-base font-semibold text-foreground">
            {s.sensitiveModalHeading}
          </h2>
        </div>

        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
          {s.sensitiveModalBody}
        </p>

        <button
          type="button"
          onClick={acknowledge}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {s.sensitiveModalAck}
        </button>
      </div>
    </div>
  );
}
