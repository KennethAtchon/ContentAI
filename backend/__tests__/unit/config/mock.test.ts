/**
 * Config / mock – generateUserInitials and type re-exports.
 */
import { describe, expect, test } from "bun:test";
import { generateUserInitials } from "@/utils/config/mock";

describe("mock (config)", () => {
  describe("generateUserInitials", () => {
    test("returns empty for null or undefined", () => {
      expect(generateUserInitials(null as any)).toBe("");
      expect(generateUserInitials(undefined as any)).toBe("");
    });

    test("returns empty for non-string", () => {
      expect(generateUserInitials(123 as any)).toBe("");
    });

    test("returns empty for empty string", () => {
      expect(generateUserInitials("")).toBe("");
    });

    test("returns empty for whitespace-only", () => {
      expect(generateUserInitials("   ")).toBe("");
    });

    test("returns punctuation-only string (no word chars) trimmed", () => {
      expect(generateUserInitials("  @#$  ")).toBe("@#$");
    });

    test("single word returns first letter uppercased", () => {
      expect(generateUserInitials("alice")).toBe("A");
      expect(generateUserInitials("Bob")).toBe("B");
    });

    test("multiple words return first letter of each word", () => {
      expect(generateUserInitials("Alice Bob")).toBe("AB");
      expect(generateUserInitials("John Doe")).toBe("JD");
    });

    test("hyphenated name returns initials for each part", () => {
      expect(generateUserInitials("Jean-Claude")).toBe("JC");
      expect(generateUserInitials("Mary-Jane Watson")).toBe("MJW");
    });

    test("apostrophe in name treats as single word", () => {
      expect(generateUserInitials("O'Connor")).toBe("O");
      expect(generateUserInitials("D'Angelo")).toBe("D");
    });

    test("leading punctuation in word is stripped", () => {
      expect(generateUserInitials(".Alice")).toBe("A");
      expect(generateUserInitials("'Bob")).toBe("B");
    });

    test("hyphenated part with only punctuation still uses first char", () => {
      expect(generateUserInitials("J--C")).toBe("JC");
    });

    test("trims outer whitespace", () => {
      expect(generateUserInitials("  Alice  ")).toBe("A");
    });

    test("word with only non-word chars after leading strip uses first char of part", () => {
      expect(generateUserInitials("a !!!")).toBe("A!");
    });

    test("hyphenated part with only punctuation uses first char of part", () => {
      expect(generateUserInitials("a-!!!-b")).toBe("A!B");
    });
  });
});
