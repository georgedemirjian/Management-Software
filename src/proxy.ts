import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route guarding only. This checks for the *presence* of the
 * session cookie — it does not verify it (cookies can be forged). Its job is
 * fast UX: bounce obviously signed-out visitors from the app shell and
 * signed-in users away from /login.
 *
 * Real enforcement lives in src/server/auth-helpers.ts (pages/actions) and
 * src/server/api.ts (route handlers), which every protected surface calls.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = getSessionCookie(request) !== null;

  const isProtected =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
