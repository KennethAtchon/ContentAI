/**
 * Unit tests for encryption utility
 * envUtil (ENCRYPTION_KEY) is mocked in __tests__/setup/bun-preload.ts
 */
import { describe, expect, test } from "bun:test";
import { encrypt, decrypt } from "@/utils/security/encryption";

describe("encryption", () => {
  test("should encrypt and decrypt roundtrip", () => {
    const plain = "secret message";
    const encrypted = encrypt(plain);
    expect(encrypted).not.toBe(plain);
    expect(encrypted).toMatch(
      /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/,
    );
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  test("should produce different ciphertext each time (IV is random)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  test("should throw on invalid encrypted format", () => {
    expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
    expect(() => decrypt("only:two")).toThrow("Invalid encrypted data format");
    expect(() => decrypt("")).toThrow("Invalid encrypted data format");
  });
});
