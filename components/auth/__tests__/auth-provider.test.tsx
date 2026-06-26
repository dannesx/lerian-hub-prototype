/**
 * Behavioral tests for the session-backed AuthProvider (RED→GREEN).
 *
 * The provider fetches GET /api/auth/me on mount (loading → authed | anon),
 * exposes session/loading/signIn/signOut, and keeps cross-tab logout via a
 * BroadcastChannel("hub_auth") "logout" message. `fetch` and `next/navigation`
 * are mocked; identity must match the /api/auth/me payload (HubSession minus
 * iat/exp).
 */
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth/auth-provider";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const IDENTITY = {
  userId: "mock:daniel.antunes@lerian.studio",
  email: "daniel.antunes@lerian.studio",
  name: "Daniel Antunes",
  initials: "DA",
  role: "Engenheiro de Software",
  company: "Lerian",
  locale: "pt-BR",
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthProvider — session lifecycle", () => {
  it("starts in loading, then resolves to authed when /api/auth/me returns 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(IDENTITY, 200));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // First synchronous render: still resolving the session.
    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toEqual(IDENTITY);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.anything());
  });

  it("resolves to anon (null session) when /api/auth/me returns 401", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 401),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });
});

describe("AuthProvider — signIn", () => {
  it("POSTs /api/auth/login then routes to returnTo", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401)) // me
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)); // login

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn("/tickets");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(replace).toHaveBeenCalledWith("/tickets");
  });

  it("routes to '/' when signIn is called without a returnTo", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn();
    });

    expect(replace).toHaveBeenCalledWith("/");
  });
});

describe("AuthProvider — signOut", () => {
  it("POSTs /api/auth/logout, broadcasts a logout message, and routes to /login", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(IDENTITY, 200)) // me
      .mockResolvedValueOnce(jsonResponse({}, 200)); // logout

    const posted: unknown[] = [];
    class FakeChannel {
      name: string;
      onmessage: ((e: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(msg: unknown) {
        posted.push(msg);
      }
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toEqual(IDENTITY);

    await act(async () => {
      await result.current.signOut();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(posted).toContainEqual({ type: "logout" });
    expect(replace).toHaveBeenCalledWith("/login");
    expect(result.current.session).toBeNull();
  });
});

describe("AuthProvider — cross-tab logout", () => {
  it("resets to anon and routes to /login when another tab broadcasts logout", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(IDENTITY, 200)); // me

    let listener: ((e: MessageEvent) => void) | null = null;
    class FakeChannel {
      name: string;
      set onmessage(fn: (e: MessageEvent) => void) {
        listener = fn;
      }
      constructor(name: string) {
        this.name = name;
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.session).toEqual(IDENTITY));

    // Simulate a logout posted by another tab.
    await act(async () => {
      listener?.({ data: { type: "logout" } } as MessageEvent);
    });

    expect(result.current.session).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("closes the BroadcastChannel on unmount", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(IDENTITY, 200));

    const closed: string[] = [];
    class FakeChannel {
      name: string;
      onmessage: ((e: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage() {}
      close() {
        closed.push(this.name);
      }
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.session).toEqual(IDENTITY));

    unmount();

    // The cross-tab effect's cleanup must close the channel it opened.
    expect(closed).toContain("hub_auth");
  });

  it("ignores non-logout broadcast messages", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(IDENTITY, 200));

    let listener: ((e: MessageEvent) => void) | null = null;
    class FakeChannel {
      set onmessage(fn: (e: MessageEvent) => void) {
        listener = fn;
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.session).toEqual(IDENTITY));

    await act(async () => {
      listener?.({ data: { type: "ping" } } as MessageEvent);
      listener?.({ data: null } as MessageEvent);
    });

    expect(result.current.session).toEqual(IDENTITY);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("AuthProvider — no BroadcastChannel support", () => {
  it("signOut still logs out and routes when BroadcastChannel is absent", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(IDENTITY, 200)) // me
      .mockResolvedValueOnce(jsonResponse({}, 200)); // logout
    vi.stubGlobal("BroadcastChannel", undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.session).toEqual(IDENTITY));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.session).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});

describe("useAuth — guard", () => {
  it("throws when used outside an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      /must be used within an <AuthProvider>/,
    );
    spy.mockRestore();
  });
});

describe("AuthProvider — children render", () => {
  it("renders children once the session resolves", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(IDENTITY, 200));

    function Probe() {
      const { loading, session } = useAuth();
      return <div>{loading ? "loading" : (session?.name ?? "anon")}</div>;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText("Daniel Antunes");
  });
});
