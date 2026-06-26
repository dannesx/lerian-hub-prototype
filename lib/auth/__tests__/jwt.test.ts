/**
 * @vitest-environment node
 *
 * Tests for the session JWT module — HS256 sign/verify via jose.
 *
 * Runs under the `node` environment (not the project-default jsdom): jose's
 * internal `payload instanceof Uint8Array` guard fails under jsdom because the
 * claims buffer is minted in a different realm than jose's `Uint8Array` global.
 * These are pure crypto tests with no DOM, so `node` is both correct and safe.
 *
 * `signSession` takes the identity claims and stamps iat/exp itself (from
 * authConfig.sessionTtlMinutes). `verifySession` is fail-closed: ANY failure
 * (bad signature, expired, malformed) returns `null` rather than throwing, so
 * callers never have to wrap it in try/catch. The `HubSession` claim shape is
 * the cross-epic contract — these round-trip tests pin it.
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/auth/jwt";
import type { HubSession } from "@/lib/auth/jwt";
import { authConfig } from "@/lib/auth/config";

/** A representative identity payload (everything except iat/exp). */
const identity: Omit<HubSession, "iat" | "exp"> = {
  userId: "user-123",
  email: "daniel.antunes@lerian.studio",
  name: "Daniel Antunes",
  initials: "DA",
  role: "admin",
  company: "Lerian",
  locale: "pt-BR",
};

describe("signSession / verifySession", () => {
  it("round-trips every identity claim field", async () => {
    const token = await signSession(identity);
    expect(typeof token).toBe("string");

    const session = await verifySession(token);
    expect(session).not.toBeNull();
    // Non-null narrowing for the strict reads below.
    if (!session) throw new Error("expected a session");

    expect(session.userId).toBe(identity.userId);
    expect(session.email).toBe(identity.email);
    expect(session.name).toBe(identity.name);
    expect(session.initials).toBe(identity.initials);
    expect(session.role).toBe(identity.role);
    expect(session.company).toBe(identity.company);
    expect(session.locale).toBe(identity.locale);
  });

  it("stamps iat and exp from the configured TTL", async () => {
    const token = await signSession(identity);
    const session = await verifySession(token);
    if (!session) throw new Error("expected a session");

    expect(typeof session.iat).toBe("number");
    expect(typeof session.exp).toBe("number");
    expect(session.exp).toBeGreaterThan(session.iat);
    // exp - iat should equal the configured TTL in seconds.
    expect(session.exp - session.iat).toBe(authConfig.sessionTtlMinutes * 60);
  });

  it("returns null for a tampered token (mutated character)", async () => {
    const token = await signSession(identity);
    // Flip a character in the signature segment so verification fails.
    const mutated =
      token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(mutated).not.toBe(token);

    expect(await verifySession(mutated)).toBeNull();
  });

  it("returns null for a garbage string", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("a.b.c")).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Craft a token that expired one minute ago using jose directly.
    const secret = new TextEncoder().encode(authConfig.jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ ...identity })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(secret);

    expect(await verifySession(expired)).toBeNull();
  });

  it("returns null when a required claim is missing (no name)", async () => {
    // Well-formed, correctly-signed token but with `name` omitted — the shape
    // guard must reject it even though jose verifies the signature fine.
    const secret = new TextEncoder().encode(authConfig.jwtSecret);
    const { name: _name, ...withoutName } = identity;
    void _name;
    const token = await new SignJWT({ ...withoutName })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });

  it("returns null when a required claim is the empty string (name)", async () => {
    const secret = new TextEncoder().encode(authConfig.jwtSecret);
    const token = await new SignJWT({ ...identity, name: "" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });

  it("returns null when a required claim has the wrong type (initials as number)", async () => {
    const secret = new TextEncoder().encode(authConfig.jwtSecret);
    const { initials: _initials, ...rest } = identity;
    void _initials;
    const token = await new SignJWT({ ...rest, initials: 42 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });

  it("never throws — returns null instead", async () => {
    // A token signed with a different secret must not throw on verify.
    const wrongSecret = new TextEncoder().encode("a-completely-different-secret-value!!");
    const foreign = await new SignJWT({ ...identity })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);

    await expect(verifySession(foreign)).resolves.toBeNull();
  });
});
