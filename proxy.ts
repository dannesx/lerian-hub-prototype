/**
 * Route-guarding proxy — runs before every matched route and gates the app
 * behind a valid `hub_token` session, mirroring operations-center's middleware
 * (read token -> verify -> redirect page routes to /login on failure).
 *
 * ⚠️ Next.js 16 convention: the `middleware` file/function is DEPRECATED and
 * renamed to `proxy` (verified against node_modules/next/dist/docs —
 * 03-api-reference/03-file-conventions/proxy.md and the version-16 upgrade
 * guide). The file lives at the repo root (sibling of `app/`), exports a
 * function named `proxy`, and `config.matcher` works exactly as before. Per
 * the version-16 guide the `edge` runtime is NOT supported in `proxy` — it
 * runs on Node.js — but `verifySession` (jose) is fine on Node too, so no
 * behavior changes.
 *
 * Flow: public paths pass through untouched. Otherwise read `hub_token` from
 * `request.cookies.get(name)` (NextRequest cookie API — no async `cookies()`
 * here), `verifySession` it, and on any failure 307-redirect to
 * `/login?returnTo=<original pathname>` while clearing the stale cookie via
 * `clearCookieOptions()`.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, clearCookieOptions } from "@/lib/auth/cookies";
import { verifySession } from "@/lib/auth/jwt";
import { isPublicPath } from "@/lib/auth/route-access";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Public surface (login, /api/auth/*, Next internals, static files) bypasses
  // session verification entirely.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySession(token);
    if (session) {
      return NextResponse.next();
    }
  }

  // No token or a failed verification — bounce to /login carrying the path the
  // user wanted so the login flow can return them there. Build the URL from
  // `nextUrl` so host/proto are preserved.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", pathname);

  const response = NextResponse.redirect(loginUrl, 307);
  // Expire any stale/invalid cookie on the way out.
  response.cookies.set(SESSION_COOKIE, "", clearCookieOptions());
  return response;
}

/**
 * Performance pre-filter ONLY — `isPublicPath` (lib/auth/route-access.ts) is the
 * AUTHORITATIVE public/protected decision. This matcher merely skips the proxy
 * for obviously-static assets (CSS/JS/images) so it never gates them; it is not
 * a second public list and must not be relied on for access decisions. Anything
 * that does reach `proxy()` is classified by `isPublicPath`, which is the single
 * source of truth. Note: per the Next.js docs, `/_next/data/*` runs through the
 * proxy regardless of this matcher, so `isPublicPath` covers it via `/_next`.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
