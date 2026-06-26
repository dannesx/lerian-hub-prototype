/**
 * @vitest-environment node
 *
 * Login in `google` mode must defer to Epic 2.1 and return 501 (Not
 * Implemented) rather than minting a mock session. `authConfig` is resolved at
 * import time, so we mock the config module to force google mode for this
 * suite only. No cookie is set on this path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthConfig } from "@/lib/auth/config";

const googleConfig: AuthConfig = {
  mode: "google",
  jwtSecret: "a-google-mode-secret-at-least-thirty-two-chars",
  cookieDomain: undefined,
  sessionTtlMinutes: 60,
  cookieSecure: true,
  google: {
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    hostedDomain: "lerian.studio",
  },
};

vi.mock("@/lib/auth/config", () => ({
  authConfig: googleConfig,
  resolveAuthConfig: () => googleConfig,
}));

beforeEach(() => {
  vi.resetModules();
});

describe("POST /api/auth/login (google mode)", () => {
  it("returns 501 Not Implemented (Epic 2.1 fills it)", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST();
    expect(res.status).toBe(501);
  });
});
