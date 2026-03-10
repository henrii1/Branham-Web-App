"use client";

import { useEffect, useRef } from "react";

const WELCOME_EMAIL_PARAM = "welcomeEmail";

interface WelcomeEmailTriggerProps {
  enabled: boolean;
}

function removeWelcomeEmailParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(WELCOME_EMAIL_PARAM)) {
    return;
  }

  url.searchParams.delete(WELCOME_EMAIL_PARAM);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", nextUrl || "/chat");
}

export function WelcomeEmailTrigger({
  enabled,
}: WelcomeEmailTriggerProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get(WELCOME_EMAIL_PARAM) !== "1") {
      return;
    }

    const sessionKey = `welcome-email-triggered:${url.pathname}`;
    if (window.sessionStorage.getItem(sessionKey) === "1") {
      removeWelcomeEmailParam();
      firedRef.current = true;
      return;
    }

    firedRef.current = true;
    window.sessionStorage.setItem(sessionKey, "1");

    void fetch("/api/welcome-email", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((error: unknown) => {
      console.error("Welcome email trigger failed:", error);
    });

    removeWelcomeEmailParam();
  }, [enabled]);

  return null;
}
