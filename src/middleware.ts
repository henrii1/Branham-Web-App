import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// OpenNext/Cloudflare adapter requires Edge middleware (proxy.ts not yet supported).
// The Next.js 16 deprecation warning is cosmetic — migrate to proxy.ts when OpenNext
// ships the Adapters API.
export const runtime = "experimental-edge";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
