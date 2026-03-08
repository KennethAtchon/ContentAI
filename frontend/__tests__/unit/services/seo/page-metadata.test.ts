/**
 * Unit tests for page metadata helper.
 */
import { describe, it, expect } from "bun:test";
import { createPageMetadata } from "@/shared/services/seo/page-metadata";

describe("page-metadata", () => {
  describe("createPageMetadata", () => {
    it("returns metadata and revalidate", () => {
      const result = createPageMetadata({
        title: "Pricing",
        description: "Pricing page",
        path: "/pricing",
      });
      expect(result.metadata).toBeDefined();
      expect(result.revalidate).toBe(3600);
      expect(result.metadata.title).toBeDefined();
      expect(result.metadata.description).toBe("Pricing page");
    });

    it("uses custom revalidate when provided", () => {
      const result = createPageMetadata({
        title: "T",
        description: "D",
        path: "/",
        revalidate: 60,
      });
      expect(result.revalidate).toBe(60);
    });

    it("sets canonical from baseUrl and path when baseUrl is set", () => {
      const result = createPageMetadata({
        title: "Home",
        description: "Home",
        path: "/home",
      });
      expect(result.metadata.alternates?.canonical).toBeDefined();
    });
  });
});
