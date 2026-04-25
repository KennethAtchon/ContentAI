/**
 * AuthGuard test with completely stable mock references.
 * Prevents infinite re-renders by returning exact same objects every time.
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach, mock, beforeAll } from "bun:test";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Create COMPLETELY STABLE mock references - these will never change
const stableNavigate = mock();
const stableLocation = { pathname: "/sign-in" };
const stableAuthenticatedFetch = mock(() => Promise.resolve({ ok: true }));
const stableAuthObject = { authenticatedFetch: stableAuthenticatedFetch };
const stableAppContext = { user: null, authLoading: false };
const stableTranslation = { t: (key: string) => key };
const stableDebugLog = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

// Mock modules BEFORE any imports - return the EXACT SAME objects every time
beforeAll(() => {
  mock.module("@tanstack/react-router", () => ({
    useNavigate: () => stableNavigate,
    useLocation: () => stableLocation,
  }));

  mock.module("react-i18next", () => ({
    useTranslation: () => stableTranslation,
  }));

  mock.module("@/app/state/app-context", () => ({
    useApp: () => stableAppContext, // Always returns same object reference
  }));

  mock.module("@/domains/auth/hooks/use-authenticated-fetch", () => ({
    useAuthenticatedFetch: () => stableAuthObject, // Always returns same object
  }));

  mock.module("@/shared/debug", () => ({
    debugLog: stableDebugLog,
  }));

  mock.module("lucide-react", () => ({
    Loader2: () => null,
  }));
});

// Import AFTER mocking
import { AuthGuard } from "@/domains/auth/ui/auth-guard";

describe("AuthGuard", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    // Reset mock call counts but keep implementations
    stableNavigate.mockClear();
    stableAuthenticatedFetch.mockClear();
    stableDebugLog.info.mockClear();
    stableDebugLog.warn.mockClear();
    stableDebugLog.error.mockClear();

    stableLocation.pathname = "/sign-in";
    Object.assign(stableAppContext, { user: null, authLoading: false });
  });

  it("renders children on sign-in route", () => {
    // Set up auth route
    stableLocation.pathname = "/sign-in";

    render(
      <AuthGuard>
        <div data-testid="signin-content">Sign In Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId("signin-content")).toBeInTheDocument();
  });

  it("shows loading spinner when auth is loading", () => {
    // Update the stable context to show loading
    Object.assign(stableAppContext, { user: null, authLoading: true });
    stableLocation.pathname = "/protected";

    render(
      <AuthGuard authType="user">
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>
    );

    // Should show loading, not the children
    expect(
      document.querySelector('[data-testid="protected-content"]')
    ).toBeNull();
    // Should show loading message (check for loading text instead of spinner)
    expect(document.body.textContent).toContain("subscription_manage_loading");

    // Reset for next test
    Object.assign(stableAppContext, { user: null, authLoading: false });
  });

  it("bypasses auth on public routes", () => {
    // Set up public route
    stableLocation.pathname = "/about";
    Object.assign(stableAppContext, { user: null, authLoading: false });

    render(
      <AuthGuard publicRoutes={["/about", "/pricing"]}>
        <div data-testid="public-content">Public Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId("public-content")).toBeInTheDocument();
  });

  it("renders children for authenticated user", () => {
    // Set up authenticated user on protected route
    const mockUser = {
      uid: "test-user",
      getIdToken: mock(() => Promise.resolve("token")),
      getIdTokenResult: mock(() =>
        Promise.resolve({ claims: { role: "user" } })
      ),
    };
    Object.assign(stableAppContext, { user: mockUser, authLoading: false });
    stableLocation.pathname = "/protected";

    render(
      <AuthGuard authType="user">
        <div data-testid="user-content">User Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId("user-content")).toBeInTheDocument();

    // Reset for next test
    Object.assign(stableAppContext, { user: null, authLoading: false });
  });

  it("redirects unauthenticated user to sign-in", () => {
    // Set up unauthenticated user on protected route
    stableLocation.pathname = "/protected";
    Object.assign(stableAppContext, { user: null, authLoading: false });

    render(
      <AuthGuard authType="user">
        <div data-testid="protected-content">Protected Content</div>
      </AuthGuard>
    );

    // Should not render children
    expect(
      document.querySelector('[data-testid="protected-content"]')
    ).toBeNull();
    // Should have called navigate to redirect
    expect(stableNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringContaining("/sign-in") })
    );
  });

  it("redirects unauthenticated admin user to sign-in", async () => {
    stableLocation.pathname = "/admin";
    Object.assign(stableAppContext, { user: null, authLoading: false });

    render(
      <AuthGuard authType="admin">
        <div data-testid="admin-content">Admin Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(stableNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/sign-in" })
      );
    });
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });

  it("renders admin content when user has admin custom claim", async () => {
    const adminUser = {
      uid: "admin-user",
      getIdToken: mock(() => Promise.resolve("admin-token")),
      getIdTokenResult: mock(() =>
        Promise.resolve({ claims: { role: "admin" } })
      ),
    };
    stableLocation.pathname = "/admin";
    Object.assign(stableAppContext, { user: adminUser, authLoading: false });

    render(
      <AuthGuard authType="admin">
        <div data-testid="admin-content">Admin Content</div>
      </AuthGuard>
    );

    expect(await screen.findByTestId("admin-content")).toBeInTheDocument();
    expect(stableAuthenticatedFetch).not.toHaveBeenCalled();
  });

  it("falls back to API verification for non-admin claim and grants access on success", async () => {
    const nonAdminUser = {
      uid: "editor-user",
      getIdToken: mock(() => Promise.resolve("refreshed-token")),
      getIdTokenResult: mock(() =>
        Promise.resolve({ claims: { role: "editor" } })
      ),
    };
    stableLocation.pathname = "/admin";
    stableAuthenticatedFetch.mockResolvedValue({ ok: true });
    Object.assign(stableAppContext, { user: nonAdminUser, authLoading: false });

    render(
      <AuthGuard authType="admin">
        <div data-testid="admin-content">Admin Content</div>
      </AuthGuard>
    );

    expect(await screen.findByTestId("admin-content")).toBeInTheDocument();
    expect(stableAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/verify");
    expect(nonAdminUser.getIdToken).toHaveBeenCalledWith(true);
  });

  it("redirects to home when API admin verification fails", async () => {
    const nonAdminUser = {
      uid: "regular-user",
      getIdToken: mock(() => Promise.resolve("token")),
      getIdTokenResult: mock(() =>
        Promise.resolve({ claims: { role: "user" } })
      ),
    };
    stableLocation.pathname = "/admin";
    stableAuthenticatedFetch.mockResolvedValue({ ok: false, status: 403 });
    Object.assign(stableAppContext, { user: nonAdminUser, authLoading: false });

    render(
      <AuthGuard authType="admin">
        <div data-testid="admin-content">Admin Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(stableNavigate).toHaveBeenCalledWith({
        to: "/admin/verify",
        search: { redirect: "/admin" },
      });
    });
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });

  it("redirects to home when admin verification throws", async () => {
    const nonAdminUser = {
      uid: "regular-user",
      getIdToken: mock(() => Promise.resolve("token")),
      getIdTokenResult: mock(() =>
        Promise.resolve({ claims: { role: "user" } })
      ),
    };
    stableLocation.pathname = "/admin";
    stableAuthenticatedFetch.mockRejectedValue(new Error("network-error"));
    Object.assign(stableAppContext, { user: nonAdminUser, authLoading: false });

    render(
      <AuthGuard authType="admin">
        <div data-testid="admin-content">Admin Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(stableNavigate).toHaveBeenCalledWith({
        to: "/admin/verify",
        search: { redirect: "/admin" },
      });
    });
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });
});
