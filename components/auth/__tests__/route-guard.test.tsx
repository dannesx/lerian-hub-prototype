/**
 * Tests for RouteGuard — the thin loading-gate for authed routes.
 *
 * `proxy.ts` enforces access server-side, so RouteGuard is display-only: it
 * renders nothing while GET /api/auth/me is in flight (avoiding a chrome flash
 * before identity is known) and renders its children once loading resolves.
 * `useAuth` is mocked so each test drives the `loading` flag directly.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteGuard } from "@/components/auth/route-guard";

const useAuth = vi.fn();

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => useAuth(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RouteGuard", () => {
  it("renders nothing while the session is loading", () => {
    useAuth.mockReturnValue({ loading: true });

    const { container } = render(
      <RouteGuard>
        <div>protected content</div>
      </RouteGuard>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("protected content")).toBeNull();
  });

  it("renders children once loading resolves", () => {
    useAuth.mockReturnValue({ loading: false });

    render(
      <RouteGuard>
        <div>protected content</div>
      </RouteGuard>,
    );

    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
