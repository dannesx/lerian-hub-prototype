/**
 * App registry — the single source of truth for the Hub's app catalog.
 *
 * In production each app is its own deploy at its own subdomain; here they are
 * routes inside one Next.js app. All data is illustrative (UX only), not real.
 */

export interface AppDef {
  /** Stable id, also used as the home-page `data-app` key. */
  id: string;
  /** Human name shown in the switcher and cards. */
  name: string;
  /** In-app route (Next `<Link>` href). */
  route: string;
  /** Illustrative production subdomain shown in the 🔒 indicator. */
  subdomain: string;
  /** Single-character glyph used as the colored app icon. */
  glyph: string;
  /**
   * Accent color as a CSS color value. These reference the brand palette
   * tokens shipped by `@lerianstudio/sindarian-ui` (sunglow / de-york /
   * vivid-tangerine / cod-gray) plus the semantic `system-info` token.
   */
  color: string;
  /** Whether the glyph foreground should be dark (for light accents). */
  darkGlyph?: boolean;
  /** Short status note shown in the app switcher row. */
  status: string;
  /** Badge text shown on the home launcher card. */
  badge: string;
  /** One-line description shown on the home launcher card. */
  context: string;
  /** Compact one-line state shown on the G2 Material launcher tile. */
  tile: string;
}

/** The launcher/home pseudo-app (no card of its own; used by the shell). */
export const HOME_APP: AppDef = {
  id: "home",
  name: "Início",
  route: "/",
  subdomain: "hub.lerian.studio",
  glyph: "✦",
  color: "var(--color-accent)",
  darkGlyph: true,
  status: "Launcher",
  badge: "",
  context: "",
  tile: "",
};

export const APPS: AppDef[] = [
  {
    id: "tickets",
    name: "Tickets",
    route: "/tickets",
    subdomain: "tickets.lerian.studio",
    glyph: "✦",
    color: "var(--color-vivid-tangerine-500)",
    status: "1 SLA crítico",
    badge: "1 SLA crítico",
    context: "3 abertos · 1 com SLA vencendo",
    tile: "3 abertos · 1 SLA",
  },
  {
    id: "gantt",
    name: "Gantt",
    route: "/gantt",
    subdomain: "gantt.lerian.studio",
    glyph: "▦",
    color: "var(--color-de-york-600)",
    status: "2 atrasadas",
    badge: "2 atrasadas",
    context: "Onboarding Acme 72%",
    tile: "Acme 72%",
  },
  {
    id: "releases",
    name: "Releases",
    route: "/releases",
    subdomain: "releases.lerian.studio",
    glyph: "⇡",
    color: "var(--color-system-info)",
    status: "4 esta semana",
    badge: "4 esta semana",
    context: "Últimas versões publicadas",
    tile: "4 esta semana",
  },
  {
    id: "client",
    name: "Visão 360",
    route: "/client",
    subdomain: "cliente.lerian.studio",
    glyph: "◎",
    color: "var(--color-sunglow-500)",
    darkGlyph: true,
    status: "2 em risco",
    badge: "2 em risco",
    context: "7 clientes · carteira consolidada",
    tile: "2 em risco",
  },
  {
    id: "onboarding",
    name: "Onboarding",
    route: "/onboarding",
    subdomain: "onboarding.lerian.studio",
    glyph: "◷",
    color: "var(--color-de-york-400)",
    status: "em curso",
    badge: "em curso",
    context: "Fluxos de implementação",
    tile: "em curso",
  },
  {
    id: "oncall",
    name: "On-call",
    route: "/oncall",
    subdomain: "oncall.lerian.studio",
    glyph: "◈",
    color: "var(--color-system-error)",
    status: "1 P1 ativo",
    badge: "1 P1 ativo",
    context: "Incidentes e escalação de plantão",
    tile: "1 P1 · 2 P2",
  },
  {
    id: "meetings",
    name: "Reuniões",
    route: "/reunioes",
    subdomain: "reunioes.lerian.studio",
    glyph: "◳",
    color: "var(--color-de-york-600)",
    status: "5 esta semana",
    badge: "5 esta semana",
    context: "Atas, action items e transcrições",
    tile: "5 esta semana",
  },
  {
    id: "sla",
    name: "Saúde SLA",
    route: "/sla",
    subdomain: "sla.lerian.studio",
    glyph: "◑",
    color: "var(--color-sunglow-500)",
    darkGlyph: true,
    status: "2 em risco",
    badge: "2 em risco",
    context: "Conformidade e breaches de SLA",
    tile: "96% · 2 em risco",
  },
  {
    id: "opspedia",
    name: "Opspedia",
    route: "/opspedia",
    subdomain: "opspedia.lerian.studio",
    glyph: "▤",
    color: "var(--color-cod-gray-600)",
    status: "base de conhecimento",
    badge: "atualizado",
    context: "Runbooks e procedimentos internos",
    tile: "12 docs recentes",
  },
];

/** Resolve an app definition by id, falling back to the home pseudo-app. */
export function appById(id: string): AppDef {
  return APPS.find((app) => app.id === id) ?? HOME_APP;
}

/**
 * Illustrative signed-in identity (single SSO account across all apps).
 * Re-exported from the auth layer so the seed has a single source — see
 * `lib/auth/mock-user.ts`. Existing UI imports `CURRENT_USER` from here.
 *
 * TODO(phase-2): the UI consumers of CURRENT_USER — `greeting.tsx`,
 * `config/page.tsx`, `app-subtitle.tsx`, `sindarian-assistant.tsx` — must move
 * to session-derived identity (useAuth().session) once the profile fields they
 * read (firstName / phone / department) are sourced from the real provider.
 * Those fields are NOT in the session token yet, so the seed re-export stays
 * until the real identity provider carries them.
 */
export { MOCK_USER as CURRENT_USER } from "@/lib/auth/mock-user";
