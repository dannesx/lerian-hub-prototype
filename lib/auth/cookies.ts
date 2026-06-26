/**
 * Session cookie helpers — operations-center-equivalent attributes for the
 * `hub_token` cookie (oc_token replicated). The route handlers in Epic 1.2
 * apply the returned options object to Next.js's cookie API; this module is
 * deliberately framework-agnostic and returns a plain object.
 *
 * Attributes mirror oc_token: httpOnly, sameSite "lax", path "/", secure from
 * `authConfig.cookieSecure` (false only in development), Domain from `authConfig.cookieDomain`
 * (undefined on localhost so the cookie scopes to the host), and maxAge from
 * the configured TTL. `clearCookieOptions()` is the same shape with maxAge 0 to
 * expire the cookie on logout.
 */
import { authConfig } from "@/lib/auth/config";

/** The session cookie name (mirrors operations-center's `oc_token`). */
export const SESSION_COOKIE = "hub_token";

/** The cookie attributes shared by set and clear. `sameSite` is the literal "lax". */
export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  domain: string | undefined;
  maxAge: number;
}

/** Attributes for setting the session cookie, with maxAge from the configured TTL. */
export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    // Secure everywhere except local dev, where there is no TLS. Resolved in
    // config.ts so this module never reads process.env directly.
    secure: authConfig.cookieSecure,
    path: "/",
    domain: authConfig.cookieDomain,
    maxAge: authConfig.sessionTtlMinutes * 60,
  };
}

/** Same attributes as the session cookie but maxAge 0 — expires it immediately. */
export function clearCookieOptions(): SessionCookieOptions {
  return { ...sessionCookieOptions(), maxAge: 0 };
}
