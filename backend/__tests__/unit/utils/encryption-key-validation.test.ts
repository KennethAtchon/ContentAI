/**
 * Covers getEncryptionKey validation (missing key).
 * Uses process.env manipulation instead of mock.module to avoid leaking
 * module mocks to subsequent test files in the same worker.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { encrypt } from "@/utils/security/encryption";

describe("encryption key validation", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = savedKey;
  });

  test("encrypt throws when ENCRYPTION_KEY is empty", () => {
    process.env.ENCRYPTION_KEY = "";
    expect(() => encrypt("x")).toThrow(
      "Environment variable ENCRYPTION_KEY is required but not set",
    );
  });
});
