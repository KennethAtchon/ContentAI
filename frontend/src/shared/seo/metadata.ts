/**
 * SEO Metadata Generation - Template
 *
 * Generates SEO-optimized metadata using app constants (APP_NAME, etc.).
 */

// import { Metadata } from "next";
import { APP_NAME } from "@/shared/constants/app.constants";
import { BASE_URL, APP_ENV } from "@/shared/config/envUtil";

// TODO: Replace with proper Next.js Metadata type when Next.js is integrated
export interface Metadata {
  title?: string;
  description?: string;
  keywords?: string | string[];
  canonical?: string;
  authors?: Array<{ name: string }>;
  creator?: string;
  publisher?: string;
  metadataBase?: URL;
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    images?: Array<{
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }>;
    locale?: string;
    type?: string;
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    images?: string[];
    site?: string;
    creator?: string;
  };
  robots?:
    | string
    | {
        index?: boolean;
        follow?: boolean;
        googleBot?: {
          index?: boolean;
          follow?: boolean;
          "max-video-preview"?: number;
          "max-image-preview"?: string;
          "max-snippet"?: number;
        };
      };
  alternates?: {
    canonical?: string;
  };
  other?: Record<string, string>;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  image?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

const DEFAULT_CONFIG = {
  siteName: APP_NAME,
  baseUrl: BASE_URL,
  defaultImage: "/images/og-default.jpg",
  twitterHandle: `@${APP_NAME.toLowerCase().replace(/\s+/g, "")}`,
  defaultKeywords: [
    "AI content",
    "instagram reels",
    "content creation",
    "viral hooks",
    "reel maker",
    "social media content",
    "SaaS studio",
    "professional reel maker",
    "content suite",
  ],
};

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    canonical,
    image,
    noIndex = false,
    noFollow = false,
  } = config;

  const fullTitle = title.includes(DEFAULT_CONFIG.siteName)
    ? title
    : `${DEFAULT_CONFIG.siteName} - ${title}`;

  const imageUrl = image || DEFAULT_CONFIG.defaultImage;
  const canonicalUrl = canonical || DEFAULT_CONFIG.baseUrl;
  const allKeywords = [...DEFAULT_CONFIG.defaultKeywords, ...keywords];

  // Determine metadataBase URL - use BASE_URL if available, otherwise use localhost for dev
  // This is used by Next.js to resolve relative image URLs for OpenGraph/Twitter cards
  const baseUrlForMetadata =
    DEFAULT_CONFIG.baseUrl !== "[BASE_URL]" && DEFAULT_CONFIG.baseUrl
      ? DEFAULT_CONFIG.baseUrl
      : APP_ENV === "production"
        ? "https://example.com" // Template fallback; set NEXT_PUBLIC_BASE_URL in production
        : "http://localhost:3000";

  return {
    metadataBase: new URL(baseUrlForMetadata),
    title: fullTitle,
    description,
    keywords: allKeywords.length > 0 ? allKeywords.join(", ") : undefined,
    authors: [{ name: DEFAULT_CONFIG.siteName }],
    creator: DEFAULT_CONFIG.siteName,
    publisher: DEFAULT_CONFIG.siteName,
    robots: {
      index: !noIndex,
      follow: !noFollow,
      googleBot: {
        index: !noIndex,
        follow: !noFollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      siteName: DEFAULT_CONFIG.siteName,
      title: fullTitle,
      description,
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: DEFAULT_CONFIG.twitterHandle,
      creator: DEFAULT_CONFIG.twitterHandle,
      title: fullTitle,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
    other: {
      "theme-color": "#1f2937",
    },
  };
}

export function generateBusinessMetadata(
  config: Omit<SEOConfig, "title" | "description"> & {
    title: string;
    description: string;
  }
): Metadata {
  return generateMetadata({
    keywords: [
      ...DEFAULT_CONFIG.defaultKeywords,
      "SaaS",
      "subscription",
      "content tools",
      "business content",
    ],
    ...config,
  });
}

export function generateProductMetadata(
  productName: string,
  description: string,
  price?: number,
  config?: Partial<SEOConfig>
): Metadata {
  const businessName = DEFAULT_CONFIG.siteName;

  return generateMetadata({
    title: `${productName} - ${businessName}`,
    description: `${description} Professional studio from ${businessName}. ${price !== undefined ? `Starting at $${price}` : "Learn more today"}.`,
    keywords: [
      productName.toLowerCase(),
      "studio",
      "content generator",
      ...DEFAULT_CONFIG.defaultKeywords,
    ],
    ...config,
  });
}

export function generatePageMetadata(
  pageName: string,
  description: string,
  config?: Partial<SEOConfig>
): Metadata {
  return generateMetadata({
    title: pageName,
    description,
    ...config,
  });
}
