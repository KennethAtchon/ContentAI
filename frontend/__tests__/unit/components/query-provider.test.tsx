/**
 * Unit tests for QueryProvider. Requires DOM (happy-dom in preload).
 */
/// <reference lib="dom" />
import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import QueryProvider from "@/app/query/query-provider";

describe("QueryProvider", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders children", () => {
    render(
      <QueryProvider>
        <span data-testid="child">Child content</span>
      </QueryProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
