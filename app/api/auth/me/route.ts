/**
 * GET /api/auth/me — return the current session identity.
 *
 * Reads the `hub_token` cookie and verifies it. On a valid session, returns
 * the HubSession identity claims with the iat/exp timing claims stripped; on a
 * missing or invalid cookie, returns 401 `{ error: "Unauthorized" }`.
 * `verifySession` is fail-closed (never throws), so any bad/expired/forged
 * token lands on the 401 branch. Cookie is the sole transport — no Bearer
 * header.
 *
 * Next.js (16.x): `cookies()` is async and must be awaited.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { toIdentity, verifySession } from "@/lib/auth/jwt";

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strip the timing claims — callers consume identity, not token internals.
  return NextResponse.json(toIdentity(session));
}
