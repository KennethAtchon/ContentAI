/**
 * Unit tests for SEO metadata generation.
 */
import { describe, it, expect } from "bun:test";
import {
  generateMetadata,
  generateBusinessMetadata,
  generateProductMetadata,
  generatePageMetadata,
} from "@/shared/seo/metadata";
import { APP_NAME } from "@/shared/constants/app.constants";

describe("metadata", () => {
  describe("generateMetadata", () => {
    it("returns Next Metadata with title, description, openGraph, twitter", () => {
      const meta = generateMetadata({
        title: "Test Page",
        description: "Test description",
      });
      expect(meta.title).toBeDefined();
      expect(meta.description).toBe("Test description");
      expect(meta.metadataBase).toBeInstanceOf(URL);
      expect(meta.openGraph).toBeDefined();
      expect(meta.openGraph?.title).toBeDefined();
      expect(meta.openGraph?.description).toBe("Test description");
      expect(meta.twitter).toBeDefined();
      expect(meta.robots).toBeDefined();
      expect(meta.robots?.index).toBe(true);
      expect(meta.robots?.follow).toBe(true);
    });

    it("does not duplicate site name when title already includes it", () => {
      const title = `${APP_NAME} - Dashboard`;
      const meta = generateMetadata({ title, description: "Desc" });
      expect(meta.title).toBe(title);
    });

    it("uses custom canonical and image when provided", () => {
      const meta = generateMetadata({
        title: "Page",
        description: "Desc",
        canonical: "https://example.com/page",
        image: "/custom-og.jpg",
      });
      expect(meta.openGraph?.url).toBe("https://example.com/page");
      expect(meta.openGraph?.images?.[0]?.url).toBe("/custom-og.jpg");
      expect(meta.alternates?.canonical).toBe("https://example.com/page");
    });

    it("respects noIndex and noFollow", () => {
      const meta = generateMetadata({
        title: "Private",
        description: "Desc",
        noIndex: true,
        noFollow: true,
      });
      expect(meta.robots?.index).toBe(false);
      expect(meta.robots?.follow).toBe(false);
    });

    it("merges custom keywords with defaults", () => {
      const meta = generateMetadata({
        title: "Page",
        description: "Desc",
        keywords: ["custom"],
      });
      expect(meta.keywords).toBeDefined();
      expect(String(meta.keywords)).toContain("custom");
    });
  });

  describe("generateBusinessMetadata", () => {
    it("returns metadata with business keywords", () => {
      const meta = generateBusinessMetadata({
        title: "Business",
        description: "Business desc",
      });
      expect(meta.title).toBeDefined();
      expect(meta.description).toBe("Business desc");
      expect(meta.keywords).toBeDefined();
      expect(String(meta.keywords)).toContain("SaaS");
    });
  });

  describe("generateProductMetadata", () => {
    it("returns product metadata with price when provided", () => {
      const meta = generateProductMetadata(
        "Mortgage Tool",
        "Calculate mortgages",
        99
      );
      expect(meta.title).toContain("Mortgage Tool");
      expect(meta.description).toContain("$99");
    });

    it("returns product metadata without price", () => {
      const meta = generateProductMetadata("Tool", "Desc");
      expect(meta.description).toContain("Learn more today");
    });
  });

  describe("generatePageMetadata", () => {
    it("returns page metadata with title and description", () => {
      const meta = generatePageMetadata("About", "About us page");
      expect(meta.title).toBeDefined();
      expect(meta.description).toBe("About us page");
    });
  });
});
