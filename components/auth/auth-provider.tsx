"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { HubSessionClaims } from "@/lib/auth/jwt";

/**
 * Session-backed client auth.
 *
 * The single Hub session is an httpOnly `hub_token` cookie (invisible to JS),
 * so the provider learns the identity by fetching GET /api/auth/me on mount.
 * `proxy.ts` (Next 16's renamed middleware) owns access enforcement —
 * unauthenticated page requests are 307-redirected server-side — so this
 * provider is display + actions only, never a gatekeeper.
 *
 * Cross-tab logout: the cookie can't be observed via the `storage` event, so we
 * broadcast a `{ type: "logout" }` message on `BroadcastChannel("hub_auth")`;
 * every tab resets to anon and routes to `/login` on receipt.
 */

/**
 * The session identity exposed to the client — /api/auth/me's payload shape.
 * Aliased to `HubSessionClaims` (the sign-input / "session minus timing" type)
 * so the identity shape has ONE declaration shared across the codebase.
 */
export type SessionUser = HubSessionClaims;

const AUTH_CHANNEL = "hub_auth";

interface AuthContextValue {
  /** The signed-in identity, or `null` while loading / when anonymous. */
  session: SessionUser | null;
  /** `true` until GET /api/auth/me resolves. */
  loading: boolean;
  /** Sign in (POST /api/auth/login) then navigate to `returnTo ?? "/"`. */
  signIn: (returnTo?: string) => Promise<void>;
  /** Sign out (POST /api/auth/logout), broadcast logout, navigate to /login. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Feature-detected BroadcastChannel — undefined in SSR/jsdom-less envs. */
function openAuthChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve the session once on mount; abortable so an unmount mid-flight
  // doesn't set state on a torn-down component.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (res.ok) {
          setSession((await res.json()) as SessionUser);
        } else {
          setSession(null);
        }
      } catch {
        // Aborted or network error → treat as anonymous.
        if (!controller.signal.aborted) setSession(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  // Cross-tab logout: another tab signed out → drop our session and bounce.
  useEffect(() => {
    const channel = openAuthChannel();
    if (!channel) return;

    channel.onmessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data as { type?: unknown }).type === "logout"
      ) {
        setSession(null);
        router.replace("/login");
      }
    };

    return () => channel.close();
  }, [router]);

  const signIn = useCallback(
    async (returnTo?: string) => {
      await fetch("/api/auth/login", { method: "POST" });
      router.replace(returnTo ?? "/");
    },
    [router],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);

    const channel = openAuthChannel();
    if (channel) {
      channel.postMessage({ type: "logout" });
      channel.close();
    }

    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, signIn, signOut }),
    [session, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
