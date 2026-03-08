/**
 * Unit tests for ErrorBoundary component.
 * Tests that it renders children normally and shows fallback on error.
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorBoundary } from "@/shared/components/layout/error-boundary";

// Component that throws on render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="children">Children rendered</div>;
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Normal content</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders custom fallback when error occurs", () => {
    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom Error</div>}
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("shows 'Something went wrong' default fallback on error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows Try Again button in default fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("does not show children when error occurred", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });
});
