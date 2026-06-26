/**
 * Auth configuration — the SINGLE place in the codebase that reads auth env
 * vars from `process.env`. Every other auth module imports `authConfig` from
 * here (see PROJECT_RULES "Auth / session conventions").
 *
 * Design mirrors operations-center: config is fail-closed. In `google` mode a
 * real signing secret (≥ 32 chars) is mandatory or resolution throws at
 * startup. In `mock` mode we fall back to a fixed dev secret so the prototype
 * runs with zero setup.
 *
 * `resolveAuthConfig(env)` takes the env object as an argument so it is fully
 * testable without mutating the process environment; `authConfig` is the
 * eagerly-resolved instance bound to the real `process.env`.
 */

/**
 * A read-only environment source. `process.env` is assignable to this, and so
 * are plain object literals in tests — without dragging in the `NODE_ENV`
 * requirement that `@types/node`'s `ProcessEnv` enforces.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Auth backend selector. */
export type AuthMode = "mock" | "google";

/** Minimum length for a JWT signing secret (HS256 needs ≥ 256 bits). */
const MIN_SECRET_LENGTH = 32;

/** Default session lifetime in minutes when `HUB_SESSION_TTL_MIN` is unset. */
const DEFAULT_SESSION_TTL_MINUTES = 60;

/**
 * Fixed dev secret used only in `mock` mode so the prototype runs with no
 * configuration. Never used in `google` mode. Must satisfy MIN_SECRET_LENGTH.
 */
const MOCK_DEV_SECRET = "hub-mock-dev-secret-not-for-production-use";

/** Google OAuth sub-config. Fields are passed through here and validated in Phase 2. */
export interface GoogleAuthConfig {
  /** OAuth client id from GOOGLE_CLIENT_ID. */
  clientId: string;
  /** OAuth client secret from GOOGLE_CLIENT_SECRET. */
  clientSecret: string;
  /** OAuth redirect URI from GOOGLE_REDIRECT_URI. */
  redirectUri: string;
  /** Workspace domain restriction. Fixed to the Lerian workspace. */
  hostedDomain: string;
}

/** Fully-resolved auth configuration consumed across the auth layer. */
export interface AuthConfig {
  /** Active auth backend. */
  mode: AuthMode;
  /** JWT signing secret. In mock mode a dev fallback; in google mode required ≥ 32 chars. */
  jwtSecret: string;
  /** Cookie `Domain` attribute. `undefined` on localhost so the cookie scopes to the host. */
  cookieDomain: string | undefined;
  /** Session lifetime in minutes, clamped to a minimum of 1. */
  sessionTtlMinutes: number;
  /** Cookie `Secure` attribute. `false` only in development (no TLS); `true` everywhere else. */
  cookieSecure: boolean;
  /** Google OAuth sub-config (present in both modes; only used in google mode). */
  google: GoogleAuthConfig;
}

/** Normalize the raw AUTH_MODE value to a known mode, defaulting to "mock". */
function parseMode(raw: string | undefined): AuthMode {
  return raw === "google" ? "google" : "mock";
}

/** Parse and clamp the session TTL; falls back to the default on bad input. */
function parseSessionTtlMinutes(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_SESSION_TTL_MINUTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SESSION_TTL_MINUTES;
  }
  // Clamp to a minimum of 1 minute — a zero/negative TTL would mint
  // already-expired sessions.
  return Math.max(1, Math.floor(parsed));
}

/**
 * Resolve the JWT secret for the given mode, fail-closed for google mode.
 * @throws if google mode is selected without a secret of at least 32 chars.
 */
function resolveJwtSecret(mode: AuthMode, raw: string | undefined): string {
  if (mode === "mock") {
    return raw && raw.length > 0 ? raw : MOCK_DEV_SECRET;
  }

  // google mode — fail-closed, like operations-center.
  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `HUB_JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in google mode (fail-closed).`,
    );
  }
  return raw;
}

/**
 * Build the auth config from an injected env object. Pure aside from the
 * fail-closed throw, so it is directly unit-testable.
 */
export function resolveAuthConfig(env: EnvSource): AuthConfig {
  const mode = parseMode(env.AUTH_MODE);

  return {
    mode,
    jwtSecret: resolveJwtSecret(mode, env.HUB_JWT_SECRET),
    cookieDomain: env.HUB_COOKIE_DOMAIN || undefined,
    sessionTtlMinutes: parseSessionTtlMinutes(env.HUB_SESSION_TTL_MIN),
    // Secure everywhere except local dev, where there is no TLS. Resolved here
    // so cookies.ts never reads process.env (PROJECT_RULES: auth env reads live
    // only in config.ts).
    cookieSecure: env.NODE_ENV !== "development",
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirectUri: env.GOOGLE_REDIRECT_URI ?? "",
      hostedDomain: "lerian.studio",
    },
  };
}

/**
 * The resolved config for the running process. Importing this is the only
 * supported way to read auth configuration elsewhere in the codebase.
 */
export const authConfig: AuthConfig = resolveAuthConfig(process.env);
