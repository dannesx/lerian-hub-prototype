/**
 * @vitest-environment node
 *
 * Integration tests for the mock-mode auth route handlers (login / me /
 * logout). They exercise the real handlers by importing their exported
 * POST/GET and invoking them with a faked `next/headers` cookie store, so the
 * full mint -> sign -> set-cookie -> read -> verify path is covered without a
 * running server.
 *
 * Runs under `node` (not jsdom): the handlers call signSession/verifySession
 * which use jose, and jose's `Uint8Array` realm guard breaks under jsdom.
 *
 * `next/headers` `cookies()` is async in this Next.js (16.x) — see
 * node_modules/next/dist/docs/.../cookies.md. The fake store below mirrors the
 * get/set surface the handlers use and is awaited by them.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { verifySession } from "@/lib/auth/jwt";
import { MOCK_USER } from "@/lib/auth/mock-user";

/** A minimal stand-in for the Next.js cookie store used by the handlers. */
interface SetCall {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

/** Per-test mutable cookie jar plus a record of every `.set` call. */
const jar = new Map<string, string>();
const setCalls: SetCall[] = [];

const fakeCookieStore = {
  get(name: string) {
    const value = jar.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string, options: Record<string, unknown> = {}) {
    jar.set(name, value);
    setCalls.push({ name, value, options });
  },
};

// `cookies()` is async in this Next.js build; resolve the fake store.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => fakeCookieStore),
}));

beforeEach(() => {
  jar.clear();
  setCalls.length = 0;
  vi.resetModules();
});

describe("POST /api/auth/login (mock mode)", () => {
  it("mints + signs a token and sets the hub_token cookie", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    // The session cookie was set with a non-empty signed token.
    const call = setCalls.find((c) => c.name === SESSION_COOKIE);
    expect(call).toBeDefined();
    if (!call) throw new Error("expected hub_token to be set");
    expect(call.value.length).toBeGreaterThan(0);

    // It is a real, verifiable session carrying the demo identity.
    const session = await verifySession(call.value);
    expect(session).not.toBeNull();
    if (!session) throw new Error("expected a verifiable session");
    expect(session.email).toBe(MOCK_USER.email);
    expect(session.name).toBe(MOCK_USER.name);

    // httpOnly cookie attributes were applied (sessionCookieOptions()).
    expect(call.options.httpOnly).toBe(true);
    expect(call.options.path).toBe("/");
    expect(call.options.sameSite).toBe("lax");
    expect(typeof call.options.maxAge).toBe("number");
    expect(call.options.maxAge as number).toBeGreaterThan(0);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the identity (minus iat/exp) for a valid cookie", async () => {
    // Log in first so the jar holds a valid hub_token.
    const { POST: login } = await import("@/app/api/auth/login/route");
    await login();

    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(MOCK_USER.email);
    expect(body.name).toBe(MOCK_USER.name);
    expect(body.initials).toBe(MOCK_USER.initials);
    // Timing claims are stripped from the response.
    expect("iat" in body).toBe(false);
    expect("exp" in body).toBe(false);
  });

  it("returns 401 Unauthorized when no cookie is present", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with the Unauthorized body when the cookie holds a garbage token", async () => {
    jar.set(SESSION_COOKIE, "not-a-jwt");
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 for a well-formed but expired token", async () => {
    // Craft a correctly-signed token that expired a minute ago using jose
    // directly, then plant it in the cookie jar.
    const { SignJWT } = await import("jose");
    const { authConfig } = await import("@/lib/auth/config");
    const { buildMockSession } = await import("@/lib/auth/mock-user");
    const secret = new TextEncoder().encode(authConfig.jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ ...buildMockSession() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(secret);
    jar.set(SESSION_COOKIE, expired);

    const { GET } = await import("@/app/api/auth/me/route");
    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the hub_token cookie (maxAge 0) and returns 200", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const res = await POST();

    expect(res.status).toBe(200);

    const call = setCalls.find((c) => c.name === SESSION_COOKIE);
    expect(call).toBeDefined();
    if (!call) throw new Error("expected hub_token to be cleared");
    expect(call.options.maxAge).toBe(0);
  });
});
