/**
 * @vitest-environment node
 *
 * Tests for the route-guarding proxy (Next.js 16's renamed middleware). They
 * exercise the real exported `proxy` against constructed `NextRequest`s and
 * assert the gate's four behaviors: pass-through on a valid session, 307 +
 * cookie-clear on missing/invalid sessions, and pass-through on public paths.
 *
 * Runs under `node` (not jsdom): the proxy calls `verifySession` (jose), whose
 * `Uint8Array` realm guard breaks under jsdom — same reason as jwt.test.ts.
 *
 * The valid cookie is minted via the real `signSession(buildMockSession())`, so
 * the pass-through case proves the full sign -> read-cookie -> verify path.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/jwt";
import { buildMockSession } from "@/lib/auth/mock-user";

const ORIGIN = "https://hub.lerian.studio";

/** Build a NextRequest for `path`, optionally carrying a `hub_token` cookie. */
function requestFor(path: string, token?: string): NextRequest {
  const req = new NextRequest(`${ORIGIN}${path}`);
  if (token !== undefined) {
    req.cookies.set(SESSION_COOKIE, token);
  }
  return req;
}

/** The `Set-Cookie` entry the proxy emits to clear the stale session, if any. */
function clearedCookie(res: NextResponse): { value: string; maxAge?: number } | undefined {
  const cookie = res.cookies.get(SESSION_COOKIE);
  return cookie ? { value: cookie.value, maxAge: cookie.maxAge } : undefined;
}

let validToken: string;

beforeAll(async () => {
  validToken = await signSession(buildMockSession());
});

describe("proxy — protected path with a valid session", () => {
  it("passes the request through (no redirect)", async () => {
    const res = await proxy(requestFor("/tickets/42", validToken));

    // NextResponse.next() carries no Location and is not a 307 redirect.
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
    // A pass-through must NOT clear the (valid) session cookie.
    expect(clearedCookie(res)).toBeUndefined();
  });
});

describe("proxy — protected path with no cookie", () => {
  it("307-redirects to /login carrying returnTo and clears the cookie", async () => {
    const res = await proxy(requestFor("/tickets/42"));

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    // The path is carried in the returnTo query param (URL-encoded by
    // searchParams.set, so decode before asserting the logical value).
    const loginUrl = new URL(location ?? "");
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("returnTo")).toBe("/tickets/42");

    const cleared = clearedCookie(res);
    expect(cleared).toBeDefined();
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });
});

describe("proxy — protected path with an invalid cookie", () => {
  it("307-redirects and clears the cookie just like the no-cookie case", async () => {
    const res = await proxy(requestFor("/tickets/42", "not-a-jwt"));

    expect(res.status).toBe(307);
    const loginUrl = new URL(res.headers.get("location") ?? "");
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("returnTo")).toBe("/tickets/42");

    const cleared = clearedCookie(res);
    expect(cleared).toBeDefined();
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });
});

describe("proxy — public path with no cookie", () => {
  it("passes /login through without a redirect", async () => {
    const res = await proxy(requestFor("/login"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
