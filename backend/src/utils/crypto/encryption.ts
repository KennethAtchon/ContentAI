/**
 * AES-256-GCM encryption utility for storing secrets in the database.
 * Key is sourced from ENCRYPTION_KEY env var (32-byte hex string).
 * Falls back to base64 encoding in development if key is not set.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ENCRYPTION_KEY } from "@/utils/config/envUtil";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer | null {
  if (!ENCRYPTION_KEY) return null;
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex").subarray(0, 32);
  // Require exactly 32 bytes — ENCRYPTION_KEY must be a 64-char hex string
  if (key.length < 32) return null;
  return key;
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

/**
 * Encrypt plaintext. Returns a base64 string: iv(12) + tag(16) + ciphertext.
 * Falls back to base64 encoding if no encryption key is configured.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) {
    // Fallback for dev environments without a key
    return Buffer.from(plaintext, "utf8").toString("base64");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64 string produced by `encrypt()`.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) {
    // Fallback for dev environments without a key
    return Buffer.from(ciphertext, "base64").toString("utf8");
  }
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
