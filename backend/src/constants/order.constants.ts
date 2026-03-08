/**
 * Order Constants - One-Time Purchase Products
 *
 * This file contains product definitions for one-time purchases.
 * These are used for testing and demonstration purposes.
 */

export interface OrderProduct {
  id: string;
  name: string;
  description: string;
  price: number; // in USD
  category: "service" | "product" | "consultation" | "report";
  featured?: boolean;
}

export const ORDER_PRODUCTS: OrderProduct[] = [
  {
    id: "custom-report",
    name: "Custom Financial Report",
    description:
      "Comprehensive financial analysis report tailored to your needs. Includes market analysis, projections, and recommendations.",
    price: 299.99,
    category: "report",
    featured: true,
  },
  {
    id: "consultation-hour",
    name: "1-Hour Financial Consultation",
    description:
      "One-on-one consultation with our financial experts. Get personalized advice on investments, retirement planning, and more.",
    price: 149.99,
    category: "consultation",
    featured: true,
  },
  {
    id: "data-export",
    name: "Premium Data Export Package",
    description:
      "Export all your calculation data in multiple formats (PDF, Excel, CSV) with advanced formatting and charts.",
    price: 49.99,
    category: "service",
  },
  {
    id: "api-access-month",
    name: "API Access - 1 Month",
    description:
      "One month of API access for programmatic access to our calculation services. Includes 10,000 API calls.",
    price: 199.99,
    category: "service",
  },
  {
    id: "white-label",
    name: "White Label Setup",
    description:
      "Custom white-label branding for your organization. Includes logo, colors, and custom domain setup.",
    price: 999.99,
    category: "service",
  },
  {
    id: "training-session",
    name: "Team Training Session",
    description:
      "On-site or virtual training session for your team. Learn how to maximize the use of our calculators.",
    price: 499.99,
    category: "consultation",
  },
  {
    id: "priority-support",
    name: "Priority Support - 3 Months",
    description:
      "3 months of priority support with guaranteed response time under 2 hours. Includes phone and email support.",
    price: 199.99,
    category: "service",
  },
  {
    id: "custom-integration",
    name: "Custom Integration Service",
    description:
      "Professional integration of our services into your existing systems. Includes setup, testing, and documentation.",
    price: 1499.99,
    category: "service",
  },
];

/**
 * Get a product by ID
 */
export function getProductById(productId: string): OrderProduct | undefined {
  return ORDER_PRODUCTS.find((product) => product.id === productId);
}

/**
 * Get featured products
 */
export function getFeaturedProducts(): OrderProduct[] {
  return ORDER_PRODUCTS.filter((product) => product.featured);
}

/**
 * Get products by category
 */
export function getProductsByCategory(
  category: OrderProduct["category"],
): OrderProduct[] {
  return ORDER_PRODUCTS.filter((product) => product.category === category);
}

/**
 * Default product for testing
 */
export const DEFAULT_PRODUCT: OrderProduct = ORDER_PRODUCTS[0];
