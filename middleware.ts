import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /api/process, /api/thoughts, /api/transcribe, /api/search, /api/conversations, /api/chat
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /icons/*, etc.
     */
    "/((?!login|register|verify-email|forgot-password|reset-password|api/auth|api/process|api/thoughts|api/transcribe|api/search|api/conversations|api/chat|api/cron|api/push|api/notifications|api/insights|api/settings|sw\\.js|_next/static|_next/image|favicon.ico).*)",
  ],
};
