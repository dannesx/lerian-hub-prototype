/**
 * Tests for the route-access helper that the proxy (Next.js 16's renamed
 * middleware) uses to decide whether a request bypasses session checks.
 *
 * `isPublicPath(pathname)` is a pure predicate so the redirect/verify logic in
 * `proxy.ts` (which is awkward to unit-test against a live NextRequest) reduces
 * to one well-tested branch. Public = the login page, the auth API subtree,
 * Next internals, and common static files. Everything else is protected.
 */
import { describe, it, expect } from "vitest";
import { isPublicPath } from "@/lib/auth/route-access";

describe("isPublicPath — public paths", () => {
  it("treats the login page as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats nested login subpaths as public", () => {
    expect(isPublicPath("/login/callback")).toBe(true);
  });

  it("treats the auth API root as public", () => {
    expect(isPublicPath("/api/auth")).toBe(true);
  });

  it("treats every /api/auth/* subpath as public", () => {
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/me")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
  });

  it("treats Next.js internals (/_next/*) as public", () => {
    expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isPublicPath("/_next/image")).toBe(true);
  });

  it("treats common root static assets as public", () => {
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
  });
});

describe("isPublicPath — protected paths", () => {
  it("protects app routes", () => {
    expect(isPublicPath("/tickets")).toBe(false);
    expect(isPublicPath("/sla")).toBe(false);
    expect(isPublicPath("/oncall")).toBe(false);
  });

  it("protects nested app routes", () => {
    expect(isPublicPath("/tickets/42")).toBe(false);
    expect(isPublicPath("/client/settings/profile")).toBe(false);
  });

  it("protects the home route", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("protects non-auth API routes", () => {
    expect(isPublicPath("/api/tickets")).toBe(false);
    expect(isPublicPath("/api/health")).toBe(false);
  });

  it("does not treat a path that merely embeds 'login' as public", () => {
    expect(isPublicPath("/account-login-history")).toBe(false);
    expect(isPublicPath("/admin/login-audit")).toBe(false);
  });

  it("does not treat an /api/authentication lookalike as public", () => {
    // Must match the /api/auth boundary, not any prefix string.
    expect(isPublicPath("/api/authn")).toBe(false);
    expect(isPublicPath("/api/authentication/login")).toBe(false);
  });
});
