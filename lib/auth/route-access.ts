/**
 * Route-access policy — the single source of truth for which request paths
 * bypass the session check in `proxy.ts` (Next.js 16's renamed middleware; see
 * proxy.ts for the convention note).
 *
 * Kept as a pure predicate so the proxy's verify/redirect branch is trivial and
 * the interesting logic (public vs protected) is exhaustively unit-testable
 * without constructing a live NextRequest.
 *
 * Public surface:
 *   - `/login` (and any subpath) — the unauthenticated landing page.
 *   - `/api/auth` and `/api/auth/*` — login/me/logout must always be reachable
 *     so a logged-out browser can mint or clear a session.
 *   - `/_next/*` — Next.js internals (chunks, image optimizer).
 *   - common root static files (favicon.ico, robots.txt, sitemap.xml).
 *
 * Boundaries are matched on path segments, not bare string prefixes, so
 * lookalikes like `/api/authentication` or `/account-login-history` stay
 * protected.
 */

/** Path prefixes that, with a trailing-`/` or exact match, are always public. */
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/_next"] as const;

/** Exact root paths served as static assets that must never be gated. */
const PUBLIC_FILES = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);

/** True at a segment boundary: `prefix` exactly, or `prefix` followed by `/`. */
function matchesSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether `pathname` is reachable without a valid session. Everything not
 * listed here is protected and falls through to session verification.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => matchesSegment(pathname, prefix));
}
