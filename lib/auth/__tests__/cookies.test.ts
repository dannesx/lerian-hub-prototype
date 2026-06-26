/**
 * Tests for the session cookie helpers — operations-center-equivalent
 * attributes for the `hub_token` cookie.
 *
 * `sessionCookieOptions()` / `clearCookieOptions()` return a plain options
 * object that route handlers (Epic 1.2) apply to the cookie API. They mirror
 * oc_token: httpOnly, sameSite "lax", path "/", secure outside development,
 * maxAge from the configured TTL. `clearCookieOptions()` is the same shape with
 * maxAge 0 to expire the cookie.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  clearCookieOptions,
} from "@/lib/auth/cookies";
import { authConfig } from "@/lib/auth/config";

/**
 * Re-import the cookies module under a stubbed NODE_ENV. `authConfig` resolves
 * `cookieSecure` eagerly at module load from `process.env`, so we reset the
 * module graph after stubbing the env to get a freshly-resolved config — this
 * is the only way to exercise both branches of the secure flag genuinely.
 */
async function secureUnderNodeEnv(value: string): Promise<boolean> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", value);
  const mod = await import("@/lib/auth/cookies");
  return mod.sessionCookieOptions().secure;
}

describe("SESSION_COOKIE", () => {
  it("is the hub_token cookie name", () => {
    expect(SESSION_COOKIE).toBe("hub_token");
  });
});

describe("sessionCookieOptions", () => {
  it("emits operations-center-equivalent attributes", () => {
    const opts = sessionCookieOptions();

    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(authConfig.sessionTtlMinutes * 60);
    expect(opts.domain).toBe(authConfig.cookieDomain);
  });

  it("is NOT secure in development (no TLS)", async () => {
    expect(await secureUnderNodeEnv("development")).toBe(false);
  });

  it("IS secure in production", async () => {
    expect(await secureUnderNodeEnv("production")).toBe(true);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("clearCookieOptions", () => {
  it("matches the session attributes but with maxAge 0", () => {
    const opts = clearCookieOptions();

    expect(opts.maxAge).toBe(0);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.domain).toBe(authConfig.cookieDomain);
  });
});
