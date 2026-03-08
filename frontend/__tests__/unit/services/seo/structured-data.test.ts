/**
 * Unit tests for structured data (JSON-LD) schema generators.
 */
import { describe, it, expect } from "bun:test";
import {
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateProductSchema,
  generateServiceSchema,
  generateFAQSchema,
  generateWebsiteSchema,
  generateBreadcrumbSchema,
  DEFAULT_BUSINESS_INFO,
} from "@/shared/services/seo/structured-data";

describe("structured-data", () => {
  const sampleBusiness = {
    name: "Test Co",
    description: "Test",
    url: "https://test.com",
    telephone: "+1-555-0100",
    email: "hi@test.com",
    address: {
      streetAddress: "123 Main",
      addressLocality: "City",
      addressRegion: "CA",
      postalCode: "90001",
      addressCountry: "US",
    },
  };

  describe("generateOrganizationSchema", () => {
    it("returns Organization JSON-LD", () => {
      const schema = generateOrganizationSchema({
        ...sampleBusiness,
      });
      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("Organization");
      expect(schema.name).toBe("Test Co");
      expect(schema.address["@type"]).toBe("PostalAddress");
      expect(schema.address.streetAddress).toBe("123 Main");
    });

    it("includes openingHours when provided", () => {
      const schema = generateOrganizationSchema({
        ...sampleBusiness,
        openingHours: ["Monday 9:00-17:00"],
      });
      expect(schema.openingHoursSpecification).toBeDefined();
      expect(schema.openingHoursSpecification[0].dayOfWeek).toBe("Monday");
    });
  });

  describe("generateLocalBusinessSchema", () => {
    it("returns LocalBusiness JSON-LD with geo", () => {
      const schema = generateLocalBusinessSchema({ ...sampleBusiness });
      expect(schema["@type"]).toBe("LocalBusiness");
      expect(schema["@id"]).toBe("https://test.com");
      expect(schema.serviceArea["@type"]).toBe("GeoCircle");
    });
  });

  describe("generateProductSchema", () => {
    it("returns Product JSON-LD with offer", () => {
      const schema = generateProductSchema(
        {
          name: "Widget",
          description: "A widget",
          category: "Tools",
          price: 29,
        },
        "https://store.com"
      );
      expect(schema["@type"]).toBe("Product");
      expect(schema.name).toBe("Widget");
      expect(schema.offers.price).toBe("29");
      expect(schema.offers.priceCurrency).toBe("USD");
    });
  });

  describe("generateServiceSchema", () => {
    it("returns Service JSON-LD", () => {
      const schema = generateServiceSchema(
        { name: "Consulting", description: "Consulting", category: "Service" },
        "https://b.com"
      );
      expect(schema["@type"]).toBe("Service");
      expect(schema.provider.url).toBe("https://b.com");
    });
  });

  describe("generateFAQSchema", () => {
    it("returns FAQPage JSON-LD", () => {
      const schema = generateFAQSchema([
        { question: "Q1?", answer: "A1" },
        { question: "Q2?", answer: "A2" },
      ]);
      expect(schema["@type"]).toBe("FAQPage");
      expect(schema.mainEntity).toHaveLength(2);
      expect(schema.mainEntity[0].name).toBe("Q1?");
      expect(schema.mainEntity[0].acceptedAnswer.text).toBe("A1");
    });
  });

  describe("generateWebsiteSchema", () => {
    it("returns WebSite JSON-LD with SearchAction", () => {
      const schema = generateWebsiteSchema(
        "https://example.com",
        "Example",
        "Site description"
      );
      expect(schema["@type"]).toBe("WebSite");
      expect(schema.potentialAction[0]["@type"]).toBe("SearchAction");
      expect(schema.potentialAction[0].target.urlTemplate).toContain("search");
    });
  });

  describe("generateBreadcrumbSchema", () => {
    it("returns BreadcrumbList JSON-LD", () => {
      const schema = generateBreadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Page", url: "/page" },
      ]);
      expect(schema["@type"]).toBe("BreadcrumbList");
      expect(schema.itemListElement).toHaveLength(2);
      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[1].position).toBe(2);
    });
  });

  describe("DEFAULT_BUSINESS_INFO", () => {
    it("is defined with required fields", () => {
      expect(DEFAULT_BUSINESS_INFO.name).toBeDefined();
      expect(DEFAULT_BUSINESS_INFO.address).toBeDefined();
      expect(DEFAULT_BUSINESS_INFO.openingHours).toBeDefined();
    });
  });
});
