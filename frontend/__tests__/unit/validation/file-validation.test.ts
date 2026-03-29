/**
 * File validation – validateFile (config, size, MIME, extension), generateSecureFilename.
 */
import { describe, expect, test } from "bun:test";
import {
  validateFile,
  generateSecureFilename,
} from "@/shared/validation/file.schema";

describe("file-validation", () => {
  describe("validateFile", () => {
    test("rejects file over size limit", async () => {
      const bigFile = new File(["x".repeat(4 * 1024 * 1024)], "test.png", {
        type: "image/png",
      });
      const result = await validateFile(bigFile, {
        maxSizeBytes: 1024,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("size"))).toBe(true);
    });

    test("rejects disallowed MIME type", async () => {
      const file = new File(["x"], "test.pdf", { type: "application/pdf" });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("type") || e.includes("extension"))
      ).toBe(true);
    });

    test("rejects disallowed extension", async () => {
      const file = new File(["x"], "test.bmp", { type: "image/bmp" });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
    });

    test("accepts valid small image and returns sanitized filename", async () => {
      // JPEG magic bytes (minimal valid header) so signature check passes
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]);
      const file = new File([jpegBytes], "photo.jpg", { type: "image/jpeg" });
      const result = await validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFilename).toBeDefined();
    });

    test("uses custom config when provided", async () => {
      const file = new File(["x"], "test.png", { type: "image/png" });
      const result = await validateFile(file, {
        maxSizeBytes: 1,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe("generateSecureFilename", () => {
    test("returns filename with timestamp and random suffix", () => {
      const name = generateSecureFilename("original.png");
      expect(name).toMatch(/^\d+_[a-z0-9]+\.png$/i);
    });

    test("uses prefix when provided", () => {
      const name = generateSecureFilename("photo.jpg", "user123");
      expect(name).toMatch(/^user123_\d+_[a-z0-9]+\.jpg$/i);
    });

    test("sanitizes dangerous characters in prefix", () => {
      const name = generateSecureFilename("a.jpg", 'pre<>fix"');
      expect(name).not.toMatch(/[<>"]/);
    });

    test("defaults to .jpg when no extension", () => {
      const name = generateSecureFilename("noext");
      expect(name).toMatch(/\.jpg$/);
    });
  });

  describe("validateFile – WebP and sanitizeFilename", () => {
    test("validates WebP signature (RIFF + WEBP at offset 8)", async () => {
      const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
      const webp = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP
      const padding = new Uint8Array(4);
      const buffer = new Uint8Array(12);
      buffer.set(riff, 0);
      buffer.set(padding, 4);
      buffer.set(webp, 8);
      const file = new File([buffer], "photo.webp", { type: "image/webp" });
      const result = await validateFile(file, { maxSizeBytes: 1024 * 1024 });
      expect(result.isValid).toBe(true);
    });

    test("rejects WebP with wrong signature", async () => {
      const buffer = new Uint8Array(12);
      buffer[0] = 0x52;
      buffer[1] = 0x49;
      buffer[2] = 0x46;
      buffer[3] = 0x46;
      buffer[8] = 0x00; // wrong byte instead of W
      const file = new File([buffer], "fake.webp", { type: "image/webp" });
      const result = await validateFile(file, { maxSizeBytes: 1024 * 1024 });
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("signature") || e.includes("MIME"))
      ).toBe(true);
    });

    test("sanitizes filename that would be . or .. to file", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
      const file = new File([jpegBytes], ".", { type: "image/jpeg" });
      const result = await validateFile(file);
      expect(result.sanitizedFilename).toBe("file");
    });

    test("truncates filename over 255 chars", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
      const longName = "a".repeat(260) + ".jpg";
      const file = new File([jpegBytes], longName, { type: "image/jpeg" });
      const result = await validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFilename!.length).toBeLessThanOrEqual(255);
    });
  });
});
