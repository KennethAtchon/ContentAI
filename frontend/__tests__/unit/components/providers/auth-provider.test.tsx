/**
 * Unit tests for AuthProvider component.
 * Tests that it renders children and provides auth context.
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

mock.module("firebase/auth", () => ({
  onAuthStateChanged: mock((_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => {};
  }),
  getAuth: mock(() => ({})),
  signInWithEmailAndPassword: mock(),
  createUserWithEmailAndPassword: mock(),
  signOut: mock(),
  updateProfile: mock(),
  signInWithPopup: mock(),
  GoogleAuthProvider: class {},
}));

mock.module("@/shared/platform/firebase-services/config", () => ({ auth: {} }));

import { AuthProvider, useAuth } from "@/app/state/auth-context";

function TestConsumer() {
  const { user, authLoading } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? "logged-in" : "logged-out"}</span>
      <span data-testid="loading">{authLoading ? "loading" : "done"}</span>
    </div>
  );
}

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children", () => {
    renderWithQuery(
      <AuthProvider>
        <div data-testid="child">Content</div>
      </AuthProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides user as null when no user logged in", () => {
    renderWithQuery(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user").textContent).toBe("logged-out");
  });

  it("transitions loading to done after auth state resolves", () => {
    renderWithQuery(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("loading").textContent).toBe("done");
  });
});

describe("useAuth", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns user and loading from context", () => {
    renderWithQuery(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
