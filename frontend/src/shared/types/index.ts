/**
 * Centralized type exports for the application
 * This file re-exports all commonly used types to avoid duplication
 */

// Re-export Drizzle types and extensions from mock.ts
export {
  // Extended UI types
  type OrderWithDetails,
  type MockOrder,
  type ProductData,

  // Re-exported Drizzle types
  type Order,
  type User,
  type ContactMessage,
  type FeatureUsage,

  // Helper functions
  generateUserInitials,
} from "@/shared/config/mock";

// Additional commonly used derived types
export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string;
  initials: string;
}

export interface OrderProduct {
  name: string;
  quantity: number;
  price: number;
}
