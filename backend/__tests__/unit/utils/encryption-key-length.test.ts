/**
 * Covers getEncryptionKey invalid length branch.
 * Uses process.env manipulation instead of mock.module to avoid leaking
 * module mocks to subsequent test files in the same worker.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { encrypt } from "@/utils/security/encryption";

describe("encryption key length", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = savedKey;
  });

  test("encrypt throws when ENCRYPTION_KEY length is not 32", () => {
    process.env.ENCRYPTION_KEY = "short";
    expect(() => encrypt("x")).toThrow(
      "ENCRYPTION_KEY must be 32 characters (256 bits) for AES-256-GCM",
    );
  });
});
