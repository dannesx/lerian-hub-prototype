"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { LerianLogo } from "@/components/shell/lerian-logo";
import { AppIcon } from "@/components/ui-app/app-icon";
import { APPS } from "@/lib/apps";

// Login shows every app glyph. Fixed-width cells keep icons aligned per row;
// the wrapping flex centers a partial last row for any app count.

/**
 * Sanitize a `returnTo` query value into a safe same-origin path. A value is
 * honored only when it is a string starting with "/" AND, once resolved against
 * a fixed dummy origin, still resolves to that same origin. Resolving and
 * comparing the origin is what makes this robust: it rejects `//host`, `/\host`
 * (browsers normalize the backslash to `/`), `\\host`, scheme URLs, and any
 * protocol-relative / absolute variant in one check — not a brittle blocklist.
 * The honored value is rebuilt from the resolved `pathname + search + hash` so
 * only the same-origin portion survives. Anything else defaults to "/".
 */
function sanitizeReturnTo(raw: string | null): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  try {
    const url = new URL(raw, "http://localhost");
    if (url.origin !== "http://localhost") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/**
 * The login card. Reads `returnTo` from the query string and hands the
 * sanitized path to `signIn`, which POSTs /api/auth/login then navigates there.
 * The buttons disable and show a pending label while that POST is in flight.
 *
 * `useSearchParams` requires a Suspense boundary (Next App Router) — see the
 * exported page below, which wraps this component.
 */
function LoginCard() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  // signIn POSTs /api/auth/login then navigates (returnTo ?? "/") itself.
  // The proxy already keeps already-signed-in users off this page server-side.
  async function handleSignIn() {
    if (pending) return;
    setPending(true);
    try {
      await signIn(sanitizeReturnTo(searchParams.get("returnTo")));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[430px] rounded-[20px] border bg-container-surface p-[34px] py-10 text-center shadow-lg">
      <LerianLogo className="mx-auto mb-7 h-5 text-body-title" />

      <div
        aria-hidden
        className="mx-auto mb-[18px] flex size-[60px] items-center justify-center rounded-[18px] bg-accent text-[30px] text-accent-foreground shadow-md"
      >
        ✦
      </div>

      <h1 className="mb-1.5 text-[22px] font-bold tracking-[-0.02em] text-body-title">
        Lerian Hub
      </h1>
      <p className="mb-[26px] text-[13.5px] leading-relaxed text-muted-foreground">
        Um acesso para todas as ferramentas Lerian.
      </p>

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent p-[13px] text-[14.5px] font-semibold text-accent-foreground outline-none transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Lock className="size-4" aria-hidden />
        {pending ? "Entrando…" : "Entrar com a conta Lerian"}
      </button>

      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={pending}
        className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-shadcn-400 bg-secondary p-3 text-[13.5px] font-medium text-body-title outline-none transition-colors hover:border-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span aria-hidden className="font-bold">
          G
        </span>
        Continuar com Google
      </button>

      <div className="my-[18px] flex items-center gap-3 text-[11px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        acesso único · SSO
      </div>

      <div className="mb-1 mt-[26px] flex flex-wrap justify-center gap-x-2 gap-y-3">
        {APPS.map((app) => (
          <div
            key={app.id}
            className="flex w-[60px] flex-col items-center gap-1.5"
          >
            <AppIcon
              glyph={app.glyph}
              color={app.color}
              darkGlyph={app.darkGlyph}
              size="md"
            />
            <span className="text-center text-[10px] leading-tight text-muted-foreground">
              {app.name}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Lock className="size-2.5" aria-hidden />
        <span className="font-mono">hub.lerian.studio</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(130% 80% at 50% -10%, var(--color-accent-mute), transparent 55%), hsl(var(--body-surface))",
      }}
    >
      {/* useSearchParams bails out of prerendering up to the nearest Suspense
          boundary; the card carries the only dynamic (query-driven) bit. */}
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
