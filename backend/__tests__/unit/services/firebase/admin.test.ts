/**
 * Unit tests for firebase/admin service.
 * firebase-admin/* modules are mocked in the preload.
 * Tests verify the adminAuth object is exported and functional.
 */
import { describe, it, expect } from "bun:test";
import { adminAuth } from "@/services/firebase/admin";

describe("firebase/admin", () => {
  it("exports adminAuth", () => {
    expect(adminAuth).toBeDefined();
  });

  it("adminAuth has verifyIdToken function", () => {
    expect(typeof adminAuth.verifyIdToken).toBe("function");
  });

  it("adminAuth has getUser function", () => {
    expect(typeof adminAuth.getUser).toBe("function");
  });

  it("adminAuth has setCustomUserClaims function", () => {
    expect(typeof adminAuth.setCustomUserClaims).toBe("function");
  });
});
