import {
  APP_NAME,
  APP_DESCRIPTION,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from "@/shared/constants/app.constants";
import { BASE_URL } from "@/shared/utils/config/envUtil";

export interface BusinessInfo {
  name: string;
  description: string;
  url: string;
  telephone: string;
  email: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  openingHours?: string[];
  priceRange?: string;
  image?: string;
}

export interface Product {
  name: string;
  description: string;
  price?: number;
  currency?: string;
  category: string;
  image?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  brand?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export function generateOrganizationSchema(business: BusinessInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization", // Generic organization type - customize as needed
    name: business.name,
    description: business.description,
    url: business.url,
    telephone: business.telephone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.streetAddress,
      addressLocality: business.address.addressLocality,
      addressRegion: business.address.addressRegion,
      postalCode: business.address.postalCode,
      addressCountry: business.address.addressCountry,
    },
    ...(business.openingHours && {
      openingHoursSpecification: business.openingHours.map((hours) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: hours.split(" ")[0],
        opens: hours.split(" ")[1],
        closes: hours.split(" ")[3],
      })),
    }),
    ...(business.priceRange && { priceRange: business.priceRange }),
    ...(business.image && { image: business.image }),
    // Optional: Add hasOfferCatalog if you have products/services
    // hasOfferCatalog: {
    //   '@type': 'OfferCatalog',
    //   name: '[SERVICE_NAME]',
    //   itemListElement: [
    //     {
    //       '@type': 'Offer',
    //       itemOffered: {
    //         '@type': 'Service',
    //         name: '[SERVICE_NAME]',
    //         description: '[SERVICE_DESCRIPTION]'
    //       }
    //     }
    //   ]
    // },
  };
}

export function generateLocalBusinessSchema(business: BusinessInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": business.url,
    name: business.name,
    description: business.description,
    url: business.url,
    telephone: business.telephone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.streetAddress,
      addressLocality: business.address.addressLocality,
      addressRegion: business.address.addressRegion,
      postalCode: business.address.postalCode,
      addressCountry: business.address.addressCountry,
    },
    ...(business.priceRange && { priceRange: business.priceRange }),
    ...(business.image && { image: business.image }),
    serviceArea: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: "40.7128",
        longitude: "-74.0060",
      },
      geoRadius: "50000",
    },
  };
}

export function generateProductSchema(
  product: Product,
  businessUrl: string,
  businessName?: string
) {
  const defaultBusinessName = businessName || APP_NAME;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    brand: {
      "@type": "Brand",
      name: product.brand || defaultBusinessName,
    },
    ...(product.image && { image: product.image }),
    offers: {
      "@type": "Offer",
      url: businessUrl,
      priceCurrency: product.currency || "USD",
      ...(product.price != null && { price: product.price.toString() }),
      availability: `https://schema.org/${product.availability || "InStock"}`,
      seller: {
        "@type": "Organization",
        name: defaultBusinessName,
      },
    },
  };
}

export function generateServiceSchema(
  service: Product,
  businessUrl: string,
  businessName?: string
) {
  const defaultBusinessName = businessName || APP_NAME;

  return {
    "@context": "https://schema.org",
    "@type": "Service", // Generic Service type - customize as needed (e.g., 'MedicalProcedure', 'ProfessionalService')
    name: service.name,
    description: service.description,
    category: service.category,
    provider: {
      "@type": "Organization",
      name: defaultBusinessName,
      url: businessUrl,
    },
    offers: {
      "@type": "Offer",
      url: businessUrl,
      priceCurrency: service.currency || "USD",
      ...(service.price != null && { price: service.price.toString() }),
      availability: `https://schema.org/${service.availability || "InStock"}`,
    },
    // Add domain-specific fields here as needed
    // e.g., procedureType: '[PROCEDURE_TYPE]',
  };
}

export function generateFAQSchema(faqs: FAQ[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateWebsiteSchema(
  businessUrl: string,
  businessName: string,
  description?: string
) {
  const defaultDescription = description || APP_DESCRIPTION;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${businessUrl}#website`,
    url: businessUrl,
    name: businessName,
    description: defaultDescription,
    publisher: {
      "@type": "Organization",
      "@id": `${businessUrl}#organization`,
    },
    potentialAction: [
      {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${businessUrl}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    ],
  };
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: APP_NAME,
  description: APP_DESCRIPTION,
  url: BASE_URL,
  telephone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  address: {
    streetAddress: "123 Example Street",
    addressLocality: "San Francisco",
    addressRegion: "CA",
    postalCode: "94105",
    addressCountry: "US",
  },
  openingHours: [
    "Monday 9:00-17:00",
    "Tuesday 9:00-17:00",
    "Wednesday 9:00-17:00",
    "Thursday 9:00-17:00",
    "Friday 9:00-17:00",
  ],
  priceRange: "$$",
};
