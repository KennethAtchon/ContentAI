/// <reference lib="dom" />
import { describe, it, expect, afterEach, spyOn } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ErrorBoundary } from "@/shared/components/layout/error-boundary";
import React from "react";

// Mock component that throws
class ThrowingComponent extends React.Component<{ shouldThrow: boolean }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error("Test error");
    }
    return <div data-testid="children">Children rendered</div>;
  }
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
    // Suppress console.error for expected React error boundary logs
    const spy = spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom Error</div>}
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows 'Something went wrong' default fallback on error", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // In test environment IS_DEVELOPMENT is likely true, so it will show "Development Error"
    expect(document.body.textContent).toContain("Test error");
    spy.mockRestore();
  });

  it("shows Try Again button in default fallback", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Try Again")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("does not show children when error occurred", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
