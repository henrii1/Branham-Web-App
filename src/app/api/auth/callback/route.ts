import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const origin =
    !isLocal && forwardedHost
      ? `https://${forwardedHost}`
      : request.nextUrl.origin;

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    loginUrl.searchParams.set(
      "error_description",
      "This sign-in link didn't work. It may have opened in a different browser or app from the one you used here, or a newer link was sent. Type the 6-digit code from the email instead, or ask for a new link."
    );
    return NextResponse.redirect(loginUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/chat";

  if (user && user.user_metadata?.onboarding_completed !== true) {
    const onboardingUrl = new URL("/onboarding/language", origin);
    if (safeNext !== "/chat") {
      onboardingUrl.searchParams.set("next", safeNext);
    }
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
