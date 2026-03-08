/**
 * Unit tests for AuthProvider component.
 * Tests that it renders children and provides auth context.
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock firebase/auth before imports
mock.module("firebase/auth", () => ({
  onAuthStateChanged: mock((_auth: any, cb: any) => {
    cb(null); // No user by default
    return () => {}; // unsubscribe
  }),
  getAuth: mock(() => ({})),
  signInWithEmailAndPassword: mock(),
  createUserWithEmailAndPassword: mock(),
  signOut: mock(),
  updateProfile: mock(),
  signInWithPopup: mock(),
  GoogleAuthProvider: class {},
}));

mock.module("@/shared/lib/firebase", () => ({ auth: {} }));
// Also mock the relative path used by auth-provider.tsx
mock.module("../../shared/lib/firebase", () => ({ auth: {} }));

import { AuthProvider, useAuth } from "@/shared/providers/auth-provider";

function TestConsumer() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? "logged-in" : "logged-out"}</span>
      <span data-testid="loading">{loading ? "loading" : "done"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders children", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Content</div>
      </AuthProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides user as null when no user logged in", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user").textContent).toBe("logged-out");
  });

  it("transitions loading to done after auth state resolves", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    // onAuthStateChanged calls cb(null) synchronously in mock
    expect(screen.getByTestId("loading").textContent).toBe("done");
  });
});

describe("useAuth", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("returns user and loading from context", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
