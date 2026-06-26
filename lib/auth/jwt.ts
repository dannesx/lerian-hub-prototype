/**
 * Session JWT — HS256 sign/verify via jose, mirroring operations-center's
 * `oc_token` token shape (we mint `hub_token`). jose is used because
 * verification must work on the Edge runtime (middleware), where Node's
 * `crypto` is unavailable.
 *
 * `signSession` accepts the identity claims and stamps `iat`/`exp` itself from
 * `authConfig.sessionTtlMinutes`; callers never pass timing claims.
 * `verifySession` is fail-closed — ANY failure (bad signature, expired,
 * malformed) yields `null` rather than throwing.
 *
 * The `HubSession` interface is the cross-epic session contract: every later
 * phase (middleware, API routes, providers) reads it. Keep it stable.
 */
import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "@/lib/auth/config";

/**
 * The verified session claim contract. Identity fields are set by the caller;
 * `iat`/`exp` are stamped by `signSession` and validated by jose on verify.
 */
export interface HubSession {
  userId: string;
  email: string;
  name: string;
  initials: string;
  role: string;
  company: string;
  locale: string;
  iat: number;
  exp: number;
}

/** The identity claims a caller supplies — everything except the timing claims. */
export type HubSessionClaims = Omit<HubSession, "iat" | "exp">;

/**
 * Project a verified `HubSession` down to its identity claims, dropping the
 * `iat`/`exp` timing claims. The single declaration of "session minus timing";
 * both GET /api/auth/me and the client provider consume this shape.
 */
export function toIdentity(session: HubSession): HubSessionClaims {
  const { iat: _iat, exp: _exp, ...identity } = session;
  void _iat;
  void _exp;
  return identity;
}

/** HS256 over the configured secret, encoded for jose. */
const secret = (): Uint8Array => new TextEncoder().encode(authConfig.jwtSecret);

/** Identity claims that must be present as non-empty strings. */
const REQUIRED_STRING_CLAIMS = [
  "userId",
  "email",
  "name",
  "initials",
  "role",
  "company",
  "locale",
] as const;

/**
 * Validate that a verified jose payload carries the full `HubSession` shape:
 * the identity fields as non-empty strings and the timing claims as numbers.
 * jose verifies the signature and `exp`, but not the application claim shape —
 * so a correctly-signed-but-malformed token would otherwise be cast blindly.
 * Returns the narrowed `HubSession` or `null`, preserving the fail-closed
 * contract.
 */
function asHubSession(payload: Record<string, unknown>): HubSession | null {
  for (const claim of REQUIRED_STRING_CLAIMS) {
    const value = payload[claim];
    if (typeof value !== "string" || value.length === 0) return null;
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    return null;
  }
  return payload as unknown as HubSession;
}

/**
 * Sign a session JWT (HS256). `iat` is set to now and `exp` to now +
 * `authConfig.sessionTtlMinutes`; the caller only provides identity claims.
 */
export async function signSession(claims: HubSessionClaims): Promise<string> {
  const ttlSeconds = authConfig.sessionTtlMinutes * 60;
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}

/**
 * Verify a session JWT and return the decoded `HubSession`, or `null` on ANY
 * failure (bad signature, expired, malformed, or a claim-shape mismatch). After
 * jose verifies the signature/exp, the payload is shape-checked against the
 * `HubSession` contract. Never throws — jose errors are caught so callers can
 * branch on null without try/catch.
 */
export async function verifySession(token: string): Promise<HubSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    // jose verified the signature/exp; now enforce the application claim shape
    // so a forged-but-incomplete payload can't be cast into a HubSession.
    return asHubSession(payload);
  } catch {
    return null;
  }
}
